// Command server serves the authenticated Better UI application and integrations.
package main

import (
	"context"
	"crypto/rand"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/config"
	"github.com/RevoTale/vikunja-better-ui/internal/integration"
	mcpserver "github.com/RevoTale/vikunja-better-ui/internal/mcp"
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
	client := vikunja.NewClient(configuration.VikunjaURL, "", vikunja.WithLogger(logger),
		vikunja.WithPublicURL(configuration.VikunjaPublicURL))
	if err := client.RequireSupportedVersion(context.Background()); err != nil {
		return err
	}
	sessions, err := auth.NewSessionManager(configuration.SessionSecret, time.Now, rand.Reader)
	if err != nil {
		return err
	}
	routes := applicationRoutes(configuration, logger, client, sessions, time.Now)
	hsts := configuration.Environment == config.EnvironmentProduction &&
		configuration.AllowedOrigin != nil && configuration.AllowedOrigin.Scheme == "https"
	return serve(newHTTPServer(configuration.HTTPAddr, hsts, routes), logger)
}

func applicationRoutes(
	configuration config.Config, logger *slog.Logger, client *vikunja.Client,
	sessions *auth.SessionManager, now func() time.Time,
) http.Handler {
	mux := http.NewServeMux()
	registerTokenIntegrations(mux, configuration, logger, now)
	browserSession := auth.HTTPContext(sessions, func(r *http.Request) *url.URL {
		return web.BrowserOrigin(configuration.AllowedOrigin, r)
	})
	graphQL := browserGraphQL(configuration, logger, client, sessions, now)
	mux.Handle("/graphql", web.GraphQLBoundary(configuration.AllowedOrigin, sessions)(graphQL))
	mux.Handle("GET /media/tasks/{task}/attachments/{attachment}", browserSession(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			session, _ := auth.SessionFromContext(r.Context())
			web.NewTaskMediaHandler(client.ForBrowserToken(session.VikunjaToken()), logger).ServeHTTP(w, r)
		})))
	publicClient := client.ForToken(configuration.VikunjaAPIToken)
	activity := service.NewPublicActivity(publicClient, now)
	allTime := service.NewPublicAllTimeActivity(publicClient, now)
	mux.Handle("/public/v1/", web.NewPublicActivityAPI(activity, allTime,
		configuration.PublicActivityEnabled, configuration.PublicAllTimeActivityEnabled, now))
	mux.HandleFunc("/healthz", healthHandler)
	mux.Handle("/readyz", readinessHandler(client, logger))
	spa := web.SPAHandler()
	pages := web.NewPublicPages(web.PublicPageOptions{
		PublicURL: configuration.PublicURL, ActivityEnabled: configuration.PublicActivityEnabled,
		AllTimeEnabled: configuration.PublicAllTimeActivityEnabled, Activity: activity, AllTime: allTime,
		PrivateFallback: spa, Now: now,
	})
	registerPublicRoutes(mux, pages, browserSession(pages), spa, configuration)
	return mux
}

func registerTokenIntegrations(
	mux *http.ServeMux, configuration config.Config, logger *slog.Logger, now func() time.Time,
) {
	mux.Handle("/integrations/v1/jobs",
		integration.NewJobsHandler(configuration.VikunjaURL, configuration.AllowedOrigin, logger, now))
	if configuration.MCPEnabled {
		mux.Handle("/mcp", mcpserver.NewHandler(mcpserver.Options{Upstream: configuration.VikunjaURL,
			PublicUpstream: configuration.VikunjaPublicURL, AppURL: configuration.AllowedOrigin,
			FallbackTimezone: configuration.MCPFallbackTimezone,
			Secret:           configuration.SessionSecret, Logger: logger, Now: now}))
	}
}

func registerPublicRoutes(
	mux *http.ServeMux,
	public http.Handler,
	private http.Handler,
	fallback http.Handler,
	configuration config.Config,
) {
	mux.Handle("GET /{$}", public)
	mux.Handle("GET /robots.txt", public)
	mux.Handle("GET /sitemap.xml", public)
	mux.Handle("GET /activity", choosePublicRoute(configuration.PublicActivityEnabled, public, private))
	mux.Handle(
		"GET /all-time-activity",
		choosePublicRoute(configuration.PublicAllTimeActivityEnabled, public, private),
	)
	mux.Handle("/", fallback)
}

func choosePublicRoute(enabled bool, public, private http.Handler) http.Handler {
	if enabled {
		return public
	}
	return private
}

func newHTTPServer(address string, hsts bool, handler http.Handler) *http.Server {
	return &http.Server{
		Addr: address, Handler: web.SecurityHeaders(hsts)(handler),
		ReadHeaderTimeout: serverReadHeaderTimeout, ReadTimeout: serverReadTimeout,
		WriteTimeout: serverWriteTimeout, IdleTimeout: serverIdleTimeout,
	}
}

func serve(server *http.Server, logger *slog.Logger) error {
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

	logger.Info("HTTP server listening", "address", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func healthHandler(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
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
	RequireSupportedVersion(context.Context) error
}

func readinessHandler(client readinessClient, logger *slog.Logger) http.Handler {
	const readinessTimeout = 3 * time.Second
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Cache-Control", "no-store")
		if request.Method != http.MethodGet {
			writer.Header().Set("Allow", http.MethodGet)
			http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		ctx, cancel := context.WithTimeout(request.Context(), readinessTimeout)
		defer cancel()
		if err := client.RequireSupportedVersion(ctx); err != nil {
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
