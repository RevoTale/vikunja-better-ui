package integration

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestAllTimeActivityHTTPFanInDoesNotMultiplyScan(t *testing.T) {
	t.Parallel()
	const total = 10_000
	var calls atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v2/user":
			_, _ = w.Write([]byte(`{"id":1,"username":"fixture","settings":{"timezone":"UTC"}}`))
		case "/api/v2/tasks":
			if r.URL.Query().Get("expand") != "" || r.URL.Query().Get("per_page") != "100" {
				t.Error("expanded or unbounded task request")
			}
			writeActivityPage(t, w, r, 100, total)
		default:
			t.Errorf("unexpected upstream endpoint: %s", r.URL.Path)
		}
	}))
	t.Cleanup(server.Close)
	baseURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	client := vikunja.NewClient(baseURL, "fixture-only")
	t.Cleanup(client.CloseIdleConnections)
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	cache := service.NewPublicAllTimeActivity(client, func() time.Time { return now })
	readAllTimeTogether(t, cache)
	if calls.Load() != 101 {
		t.Fatalf("100 readers amplified upstream scan: %d requests", calls.Load())
	}
	now = now.Add(time.Second)
	if _, err := cache.Read(t.Context()); err != nil || calls.Load() != 101 {
		t.Fatalf("cached read repeated scan: %d, %v", calls.Load(), err)
	}
	t.Log("10,000 tasks, 100 concurrent visitors: 101 upstream HTTP requests, cache hit adds zero")
}

func readAllTimeTogether(t *testing.T, cache *service.PublicAllTimeActivity) {
	t.Helper()
	var group sync.WaitGroup
	var successes atomic.Int64
	for range 100 {
		group.Go(func() {
			result, err := cache.Read(t.Context())
			if err == nil {
				successes.Add(1)
				if result.Total != 10_000 {
					t.Error("partial aggregate exposed")
				}
			} else if !errors.Is(err, service.ErrActivityBusy) {
				t.Errorf("unexpected read failure: %v", err)
			}
		})
	}
	group.Wait()
	if successes.Load() == 0 {
		t.Fatal("no visitor received the coalesced snapshot")
	}
}
