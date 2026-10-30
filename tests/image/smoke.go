package main

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	imageTag   = "vikunja-better-ui:smoke"
	helperPath = "/tmp/smoke-helper"
)

type smokeRun struct {
	directory string
	container string
	upstream  string
	network   string
}

func smoke(ctx context.Context) (err error) {
	directory, err := os.MkdirTemp("", "vbu-image-smoke-")
	if err != nil {
		return err
	}
	name := "vbu-smoke-" + strings.ToLower(rand.Text())
	run := smokeRun{directory: directory, container: name, upstream: name + "-upstream", network: name + "-network"}
	defer func() { run.cleanup(ctx, err != nil) }()
	if err = run.prepare(ctx); err != nil {
		return err
	}
	if err = run.startUpstream(ctx); err != nil {
		return err
	}
	if err = run.startApp(ctx); err != nil {
		return err
	}
	if err = waitProbe(ctx, run.container, "http://127.0.0.1:8080"); err != nil {
		return err
	}
	output, err := dockerCommand(ctx, "inspect", "--format", "{{.Config.User}}", run.container).Output()
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(output)) != "nonroot:nonroot" {
		return errors.New("production image does not run as nonroot")
	}
	return nil
}

func docker(ctx context.Context, args ...string) error {
	command := dockerCommand(ctx, args...)
	command.Stdout, command.Stderr = os.Stdout, os.Stderr
	return command.Run()
}

func dockerCommand(ctx context.Context, args ...string) *exec.Cmd {
	//nolint:gosec // The smoke runner constructs Docker arguments for its own randomly named disposable resources.
	return exec.CommandContext(ctx, "docker", args...)
}

func (run smokeRun) prepare(ctx context.Context) error {
	if err := docker(ctx, "build", "--tag", imageTag, "."); err != nil {
		return err
	}
	//nolint:gosec // The helper is built from a fixed package into this run's private temporary directory.
	command := exec.CommandContext(ctx, "go", "build", "-o", filepath.Join(run.directory, "helper"), "./tests/image")
	command.Env = append(os.Environ(), "CGO_ENABLED=0", "GOOS=linux")
	command.Stdout, command.Stderr = os.Stdout, os.Stderr
	if err := command.Run(); err != nil {
		return err
	}
	if err := certificates(run.directory, run.upstream); err != nil {
		return err
	}
	return docker(ctx, "network", "create", run.network)
}

func (run smokeRun) copy(ctx context.Context, container, source, target string) error {
	return docker(ctx, "cp", filepath.Join(run.directory, source), container+":"+target)
}

func (run smokeRun) startUpstream(ctx context.Context) error {
	// The synthetic TLS helper runs as root to read its copied private key; the application stays nonroot.
	if err := docker(ctx, "create", "--name", run.upstream, "--network", run.network, "--user", "0:0",
		"--entrypoint", helperPath, imageTag, "serve"); err != nil {
		return err
	}
	for source, target := range map[string]string{"helper": helperPath, "cert.pem": certPath, "key.pem": keyPath} {
		if err := run.copy(ctx, run.upstream, source, target); err != nil {
			return err
		}
	}
	if err := docker(ctx, "start", run.upstream); err != nil {
		return err
	}
	return waitProbe(ctx, run.upstream, "https://"+run.upstream+":3456")
}

func (run smokeRun) startApp(ctx context.Context) error {
	const createArgumentCapacity = 24
	args := make([]string, 0, createArgumentCapacity)
	args = append(args, "create", "--name", run.container, "--network", run.network)
	for _, variable := range []string{
		"APP_ENV=production", "APP_VIKUNJA_URL=https://" + run.upstream + ":3456", "SSL_CERT_FILE=" + certPath,
		"APP_VIKUNJA_API_TOKEN=smoke-token", "APP_AUTH_USERNAME=smoke-user", "APP_AUTH_PASSWORD=smoke-password",
		"APP_SESSION_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
		"APP_HTTP_ADDR=:8080", "APP_ALLOWED_ORIGIN=https://tasks.example.invalid",
	} {
		args = append(args, "--env", variable)
	}
	if err := docker(ctx, append(args, imageTag)...); err != nil {
		return err
	}
	if err := run.copy(ctx, run.container, "cert.pem", certPath); err != nil {
		return err
	}
	if err := run.copy(ctx, run.container, "helper", helperPath); err != nil {
		return err
	}
	return docker(ctx, "start", run.container)
}

func waitProbe(ctx context.Context, container, url string) error {
	const readinessTimeout = 30 * time.Second
	const retryInterval = 250 * time.Millisecond
	ctx, cancel := context.WithTimeout(ctx, readinessTimeout)
	defer cancel()
	var lastOutput []byte
	for {
		output, err := dockerCommand(ctx, "exec", container, helperPath, "probe", url).CombinedOutput()
		if err == nil {
			return nil
		}
		if len(output) > 0 {
			lastOutput = output
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("smoke container did not become ready: %s", strings.TrimSpace(string(lastOutput)))
		case <-time.After(retryInterval):
		}
	}
}

func (run smokeRun) cleanup(ctx context.Context, failed bool) {
	const cleanupTimeout = 30 * time.Second
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()
	if failed {
		_ = docker(ctx, "logs", run.container)
		_ = docker(ctx, "logs", run.upstream)
	}
	_ = docker(ctx, "rm", "-f", run.container, run.upstream)
	_ = docker(ctx, "network", "rm", run.network)
	_ = os.RemoveAll(run.directory)
}
