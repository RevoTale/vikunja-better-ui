package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
)

const (
	runCommand            = "run"
	frontendDirectoryFlag = "--dir"
	frontendDirectory     = "frontend"
	pnpmCommand           = "pnpm"
	goCommand             = "go"
	buildCommand          = "build"
)

func runHarness(ctx context.Context, args []string) (err error) {
	root, err := os.Getwd()
	if err != nil {
		return err
	}
	directory, err := os.MkdirTemp("", "vikunja-better-ui-e2e.")
	if err != nil {
		return err
	}
	h := &harness{root: root, directory: directory}
	defer func() { h.cleanup(ctx, err != nil) }()
	h.environment = append(h.environment, "E2E_FIXTURE_DIR="+directory)
	upstream, username, password, err := h.startVikunja(ctx)
	if err != nil {
		return err
	}
	h.environment = append(h.environment, "E2E_VIKUNJA_USERNAME="+username, "E2E_VIKUNJA_PASSWORD="+password)
	fixtures, err := h.fixtures(ctx, upstream, username, password)
	if err != nil {
		return err
	}
	if err = h.buildApp(ctx); err != nil {
		return err
	}
	appURL, err := h.configureApp(ctx, upstream, fixtures)
	if err != nil {
		return err
	}
	app, err := h.start(ctx, "app.log", filepath.Join(directory, "app"))
	if err != nil {
		return err
	}
	_, port, err := net.SplitHostPort(h.address)
	if err != nil {
		return err
	}
	if err = waitReady(ctx, "http://127.0.0.1:"+port+"/readyz"); err != nil {
		return err
	}
	select {
	case <-app.done:
		return fmt.Errorf("application exited during startup: %w", app.err)
	default:
	}
	if os.Getenv("E2E_DEMO") == "1" {
		_, _ = fmt.Fprintf(os.Stdout, "Demo URL: %s\nUsername: app-user\nPassword: app-password-strong\n", appURL)
		<-ctx.Done()
		return nil
	}
	return h.playwright(ctx, args)
}

func (h *harness) buildApp(ctx context.Context) error {
	for _, args := range [][]string{
		{pnpmCommand, frontendDirectoryFlag, frontendDirectory, runCommand, "generate:graphql"},
		{pnpmCommand, frontendDirectoryFlag, frontendDirectory, runCommand, buildCommand},
		{goCommand, buildCommand, "-o", filepath.Join(h.directory, "app"), "./cmd/server"},
	} {
		if err := h.command(ctx, args[0], args[1:]...).Run(); err != nil {
			return err
		}
	}
	return nil
}

func (h *harness) configureApp(ctx context.Context, upstream string, fixtures map[string]string) (string, error) {
	address, err := freeAddress(ctx)
	if err != nil {
		return "", err
	}
	if port := os.Getenv("E2E_APP_PORT"); port != "" {
		address = net.JoinHostPort("127.0.0.1", port)
	}
	appURL := "http://" + address
	if os.Getenv("E2E_DEMO") == "1" {
		_, port, splitErr := net.SplitHostPort(address)
		if splitErr != nil {
			return "", splitErr
		}
		address = net.JoinHostPort("0.0.0.0", port)
		if origin := os.Getenv("E2E_DEMO_ORIGIN"); origin != "" {
			appURL = origin
		}
	}
	h.address = address
	h.environment = append(h.environment,
		"APP_ENV=test", "APP_PUBLIC_ACTIVITY_ENABLED=true", "PUBLIC_ALL_TIME_ACTIVITY=true",
		"APP_VIKUNJA_URL="+upstream, "APP_VIKUNJA_API_TOKEN="+fixtures["token"],
		"APP_AUTH_USERNAME=app-user", "APP_AUTH_PASSWORD=app-password-strong",
		"APP_SESSION_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
		"APP_HTTP_ADDR="+address, "APP_ALLOWED_ORIGIN="+appURL, "APP_LOG_LEVEL=warn",
		"E2E_BASE_URL="+appURL, "E2E_VIKUNJA_URL="+upstream, "E2E_VIKUNJA_API_TOKEN="+fixtures["token"],
	)
	for variable, key := range map[string]string{
		"E2E_PROJECT_ID": "projectId", "E2E_EMPTY_PROJECT_ID": "emptyProjectId", "E2E_TIMEZONE": fixtureTimezoneField,
		"E2E_INVALID_TITLE": "invalidTitle", "E2E_LABELED_TITLE": "labeledTitle",
	} {
		h.environment = append(h.environment, variable+"="+fixtures[key])
	}
	return appURL, nil
}

func (h *harness) fixtures(ctx context.Context, upstream, username, password string) (map[string]string, error) {
	// The harness owns this freshly created private directory. Browser tests still
	// validate the origin and ownership marker before seeding through the API.
	const markerMode = 0o600
	markerPath := filepath.Join(h.directory, ".discussion-fixture")
	//nolint:gosec // The harness creates this marker exclusively in its own newly allocated private directory.
	marker, err := os.OpenFile(markerPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, markerMode)
	if err != nil {
		return nil, err
	}
	_, err = marker.WriteString(upstream)
	closeErr := marker.Close()
	if err != nil {
		return nil, err
	}
	if closeErr != nil {
		return nil, closeErr
	}
	return seedFixtures(ctx, upstream, username, password, os.Getenv("E2E_DEMO") == "1")
}

func (h *harness) playwright(ctx context.Context, args []string) error {
	arguments := append([]string{frontendDirectoryFlag, frontendDirectory, "exec", "playwright", "test"}, args...)
	command := h.command(ctx, pnpmCommand, arguments...)
	if os.Getenv("E2E_MEASURE") == "1" {
		arguments = append([]string{runCommand, "./tests/e2e/harness", "measure", pnpmCommand}, arguments...)
		command = h.command(ctx, goCommand, arguments...)
	}
	return command.Run()
}
