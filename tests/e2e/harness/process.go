package main

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

const readinessTimeout = 30 * time.Second

type harness struct {
	databaseContainer string
	address           string
	root              string
	directory         string
	environment       []string
	processes         []*backgroundProcess
}

type backgroundProcess struct {
	command *exec.Cmd
	done    chan struct{}
	err     error
	log     *os.File
}

func (h *harness) command(ctx context.Context, name string, args ...string) *exec.Cmd {
	//nolint:gosec // All command names are selected by the harness; arguments are passed without a shell.
	command := exec.CommandContext(ctx, name, args...)
	command.Dir, command.Env = h.root, append(os.Environ(), h.environment...)
	command.Stdout, command.Stderr = os.Stdout, os.Stderr
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	command.Cancel = func() error { return syscall.Kill(-command.Process.Pid, syscall.SIGKILL) }
	command.WaitDelay = time.Second
	return command
}

func (h *harness) start(ctx context.Context, logName, name string, args ...string) (*backgroundProcess, error) {
	//nolint:gosec // Log names are fixed by the harness inside its newly created private directory.
	log, err := os.Create(filepath.Join(h.directory, logName))
	if err != nil {
		return nil, err
	}
	command := h.command(ctx, name, args...)
	command.Stdout, command.Stderr = log, log
	if err = command.Start(); err != nil {
		_ = log.Close()
		return nil, err
	}
	process := &backgroundProcess{command: command, done: make(chan struct{}), log: log}
	go func() { process.err = command.Wait(); close(process.done) }()
	h.processes = append(h.processes, process)
	return process, nil
}

func (h *harness) cleanup(ctx context.Context, failed bool) {
	for _, process := range h.processes {
		select {
		case <-process.done:
		default:
			_ = process.command.Cancel()
			<-process.done
		}
		if failed {
			_, _ = process.log.Seek(0, io.SeekStart)
			_, _ = io.Copy(os.Stderr, process.log)
		}
		_ = process.log.Close()
	}
	h.cleanupPostgres(ctx, failed)
	_ = os.RemoveAll(h.directory)
}

func freeAddress(ctx context.Context) (string, error) {
	var config net.ListenConfig
	listener, err := config.Listen(ctx, "tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	address := listener.Addr().String()
	return address, listener.Close()
}

func waitReady(ctx context.Context, url string) error {
	ctx, cancel := context.WithTimeout(ctx, readinessTimeout)
	defer cancel()
	client := &http.Client{Timeout: time.Second}
	for {
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		response, err := client.Do(request)
		if err == nil {
			_ = response.Body.Close()
			if response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices {
				return nil
			}
		}
		select {
		case <-ctx.Done():
			return errors.New("timed out waiting for fixture service readiness")
		case <-time.After(sampleInterval):
		}
	}
}
