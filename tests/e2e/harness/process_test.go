package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

func TestReadinessRetriesAndHonorsCancellation(t *testing.T) {
	t.Parallel()
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
	}))
	t.Cleanup(server.Close)
	if err := waitReady(t.Context(), server.URL); err != nil {
		t.Fatal(err)
	}
	if calls.Load() < 2 {
		t.Fatal("did not retry unavailable service")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := waitReady(ctx, server.URL); err == nil {
		t.Fatal("ignored cancellation")
	}
}

func TestDemoProbeUsesLocalListenAddress(t *testing.T) {
	t.Setenv("E2E_DEMO", "1")
	t.Setenv("E2E_APP_PORT", "4180")
	t.Setenv("E2E_DEMO_ORIGIN", "https://preview.example.test")
	h := &harness{}
	url, err := h.configureApp(t.Context(), "http://127.0.0.1:3456", map[string]string{})
	if err != nil || url != "https://preview.example.test" || h.address != "0.0.0.0:4180" {
		t.Fatalf("url=%s address=%s err=%v", url, h.address, err)
	}
}

func TestCleanupStopsOwnedProcessAndRemovesFixture(t *testing.T) {
	t.Setenv("HARNESS_PROCESS_CHILD", "1")
	directory := filepath.Join(t.TempDir(), "fixture")
	if err := os.Mkdir(directory, 0o700); err != nil {
		t.Fatal(err)
	}
	h := &harness{directory: directory}
	process, err := h.start(t.Context(), "app.log", os.Args[0], "-test.run=^TestProcessChild$")
	if err != nil {
		t.Fatal(err)
	}
	h.cleanup(t.Context(), false)
	select {
	case <-process.done:
	default:
		t.Fatal("child still running after cleanup")
	}
	if _, err = os.Stat(directory); !os.IsNotExist(err) {
		t.Fatalf("fixture remains: %v", err)
	}
}

func TestProcessChild(_ *testing.T) {
	if os.Getenv("HARNESS_PROCESS_CHILD") == "1" {
		time.Sleep(time.Minute)
		os.Exit(0)
	}
}
