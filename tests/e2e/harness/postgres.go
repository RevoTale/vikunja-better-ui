package main

import (
	"context"
	"crypto/rand"
	"net"
	"os"
	"strings"
	"time"
)

const postgresImage = "postgres:18.6-trixie@sha256:979bccfde35445db618c65107d27d08c6c21339d8dc3ad4c830c6633947be0e4"

func (h *harness) startPostgres(ctx context.Context) error {
	address, err := freeAddress(ctx)
	if err != nil {
		return err
	}
	_, port, err := net.SplitHostPort(address)
	if err != nil {
		return err
	}
	host, err := os.Hostname()
	if err != nil {
		return err
	}
	h.databaseContainer = "vbu-e2e-postgres-" + strings.ToLower(rand.Text())
	// Only this disposable loopback fixture uses trust authentication.
	if err = h.command(ctx, "docker", "run", "--detach", "--rm", "--name", h.databaseContainer,
		"--network", "container:"+host, "--tmpfs", "/var/lib/postgresql:rw,size=512m",
		"--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--env", "POSTGRES_USER=vikunja_test",
		"--env", "POSTGRES_DB=vikunja_test", postgresImage,
		"postgres", "-p", port, "-c", "listen_addresses=127.0.0.1").Run(); err != nil {
		return err
	}
	h.environment = append(h.environment, "VIKUNJA_DATABASE_TYPE=postgres", "VIKUNJA_DATABASE_HOST="+address,
		"VIKUNJA_DATABASE_USER=vikunja_test", "VIKUNJA_DATABASE_PASSWORD=", "VIKUNJA_DATABASE_DATABASE=vikunja_test",
		"VIKUNJA_DATABASE_SSLMODE=disable")
	return waitPostgres(ctx, address)
}

func waitPostgres(ctx context.Context, address string) error {
	ctx, cancel := context.WithTimeout(ctx, readinessTimeout)
	defer cancel()
	for {
		if postgresSessionReady(ctx, address) {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(sampleInterval):
		}
	}
}

func (h *harness) cleanupPostgres(ctx context.Context, failed bool) {
	if h.databaseContainer == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), readinessTimeout)
	defer cancel()
	if failed {
		_ = h.command(ctx, "docker", "logs", "--tail", "80", h.databaseContainer).Run()
	}
	_ = h.command(ctx, "docker", "rm", "-f", h.databaseContainer).Run()
}
