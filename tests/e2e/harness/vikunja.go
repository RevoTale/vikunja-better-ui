package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func (h *harness) startVikunja(ctx context.Context) (string, string, string, error) {
	if os.Getenv("E2E_VIKUNJA_SERVICE") == "1" {
		return h.serviceVikunja(ctx)
	}
	binary, err := h.localBinary(ctx)
	if err != nil {
		return "", "", "", err
	}
	if err = h.startPostgres(ctx); err != nil {
		return "", "", "", err
	}
	address, err := freeAddress(ctx)
	if err != nil {
		return "", "", "", err
	}
	upstream := "http://" + address
	h.environment = append(h.environment,
		"VIKUNJA_FILES_BASEPATH="+filepath.Join(h.directory, "files"), "VIKUNJA_SERVICE_INTERFACE="+address,
		"VIKUNJA_SERVICE_PUBLICURL="+upstream, "VIKUNJA_SERVICE_FRONTENDURL="+upstream,
		"VIKUNJA_SERVICE_SECRET=vikunja-e2e-process-secret", "VIKUNJA_SERVICE_ENABLEREGISTRATION=false",
		"VIKUNJA_MAILER_ENABLED=false",
	)
	//nolint:gosec // Public test credentials for the freshly created loopback-only fixture, not a real account.
	const username, password = "e2e-user", "e2e-password-strong"
	for _, args := range [][]string{
		{"migrate"}, {"user", "create", "--username", username, "--email", "e2e@example.invalid", "--password", password},
	} {
		if err = h.command(ctx, binary, args...).Run(); err != nil {
			return "", "", "", err
		}
	}
	if _, err = h.start(ctx, "vikunja.log", binary, "web"); err != nil {
		return "", "", "", err
	}
	return upstream, username, password, waitReady(ctx, upstream+"/api/v2/info")
}

func (h *harness) serviceVikunja(ctx context.Context) (string, string, string, error) {
	workspace, err := filepath.EvalSymlinks(os.Getenv("CI_WORKSPACE"))
	if err != nil || os.Getenv("CI_SYSTEM_NAME") != "woodpecker" {
		return "", "", "", errors.New("service mode requires the isolated Woodpecker workspace")
	}
	root, err := filepath.EvalSymlinks(h.root)
	if err != nil {
		return "", "", "", err
	}
	if workspace != root {
		return "", "", "", errors.New("service workspace does not match test checkout")
	}
	const upstream = "http://vikunja:3456"
	h.environment = append(h.environment,
		"VIKUNJA_SERVICE_PUBLICURL="+upstream,
	)
	if err = waitReady(ctx, upstream+"/api/v2/info"); err != nil {
		return "", "", "", fmt.Errorf("check Woodpecker's vikunja service log: %w", err)
	}
	command := h.command(ctx, goCommand, runCommand, "./tests/e2e/harness/service-user")
	command.Stdout = nil
	output, err := command.Output()
	if err != nil {
		return "", "", "", err
	}
	credentials := strings.Fields(string(output))
	const credentialFields = 2
	if len(credentials) != credentialFields {
		return "", "", "", errors.New("invalid service credentials output")
	}
	return upstream, credentials[0], credentials[1], nil
}
