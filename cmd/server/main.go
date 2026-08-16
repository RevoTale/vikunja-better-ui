package main

import (
	"context"
	"crypto/rand"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/config"
	graphqlserver "github.com/RevoTale/vikunja-better-ui/internal/graphql"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/resolver"
	"github.com/RevoTale/vikunja-better-ui/internal/integration"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	"github.com/RevoTale/vikunja-better-ui/internal/web"
)

const (
	serverReadHeaderTimeout = 5 * time.Second
	serverReadTimeout       = 15 * time.Second
	serverWriteTimeout      = 35 * time.Second
	serverIdleTimeout       = 60 * time.Second
	shutdownTimeout         = 10 * time.Second
)

func main() {
	configuration, err := config.Load(os.LookupEnv)
	if err != nil {
		slog.Error("invalid configuration", "cause", err)
		os.Exit(1)
	}
	logger := newLogger(configuration.LogLevel)
	if err := run(configuration, logger); err != nil {
		logger.Error("server stopped", "cause", err)
		os.Exit(1)
	}
}

func run(configuration config.Config, logger *slog.Logger) error {
	now := time.Now
	production := configuration.Environment == config.EnvironmentProduction
	vikunjaClient := vikunja.NewClient(configuration.VikunjaURL, configuration.VikunjaAPIToken)
	sessions := auth.NewSessionManager(configuration.SessionSecret, now, rand.Reader)
	cookies := auth.NewSessionCookies(production)
	capabilities := service.NewCapabilityManager(configuration.SessionSecret, now)
	root := resolver.New(resolver.Dependencies{
		Credentials: auth.NewCredentials(configuration.AuthUsername, configuration.AuthPassword),
		Sessions:    sessions, Cookies: cookies, Limiter: auth.NewLoginLimiter(now),
		Users: vikunjaClient, Projects: vikunjaClient, Tasks: vikunjaClient,
		Capabilities: capabilities, Logger: logger, Now: now,
	})

	mux := http.NewServeMux()
	graphQL := graphqlserver.NewHandler(root, production, logger)
	mux.Handle("/graphql", web.GraphQLBoundary(configuration.AllowedOrigin)(auth.HTTPContext(sessions, cookies)(graphQL)))
	mux.Handle(
		"/integrations/v1/jobs",
		integration.NewJobsHandler(configuration.VikunjaURL, configuration.AllowedOrigin, logger, now),
	)
	mux.HandleFunc("/healthz", healthHandler)
	mux.Handle("/readyz", readinessHandler(vikunjaClient, logger))
	mux.Handle("/", web.SPAHandler())

	server := &http.Server{
		Addr: configuration.HTTPAddr, Handler: web.SecurityHeaders(production)(mux),
		ReadHeaderTimeout: serverReadHeaderTimeout, ReadTimeout: serverReadTimeout,
		WriteTimeout: serverWriteTimeout, IdleTimeout: serverIdleTimeout,
	}
	shutdownContext, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-shutdownContext.Done()
		ctx, cancel := context.WithTimeout(context.WithoutCancel(shutdownContext), shutdownTimeout)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			logger.Error("graceful shutdown failed", "cause", err)
		}
	}()

	logger.Info("HTTP server listening", "address", configuration.HTTPAddr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func healthHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writer.Header().Set("Allow", http.MethodGet)
		http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write([]byte("ok\n"))
}

type readinessClient interface {
	CurrentUser(context.Context) (vikunja.User, error)
}

func readinessHandler(client readinessClient, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writer.Header().Set("Allow", http.MethodGet)
			http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		ctx, cancel := context.WithTimeout(request.Context(), 3*time.Second)
		defer cancel()
		if _, err := client.CurrentUser(ctx); err != nil {
			logger.Warn("readiness check failed", "cause", err)
			http.Error(writer, "not ready", http.StatusServiceUnavailable)
			return
		}
		writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("ready\n"))
	})
}

func newLogger(level config.LogLevel) *slog.Logger {
	logLevel := slog.LevelInfo
	switch level {
	case config.LogLevelDebug:
		logLevel = slog.LevelDebug
	case config.LogLevelWarn:
		logLevel = slog.LevelWarn
	case config.LogLevelError:
		logLevel = slog.LevelError
	case config.LogLevelInfo:
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel}))
}
