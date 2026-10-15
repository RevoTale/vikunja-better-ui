// Package integration exercises complete application paths against bounded local HTTP fixtures.
package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestPublicActivityLargeHTTPDatasetSharesOneHourlyScan(t *testing.T) {
	t.Parallel()
	for _, pageSize := range []int{100, 50} {
		t.Run(strconv.Itoa(pageSize), func(t *testing.T) {
			t.Parallel()
			verifyLargeActivityHTTP(t, pageSize)
		})
	}
}

func verifyLargeActivityHTTP(t *testing.T, pageSize int) {
	t.Helper()
	const total = 10_000
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	var requests atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet || r.Header.Get("Authorization") != "Bearer fixture-only" {
			t.Error("unexpected upstream method or authorization")
		}
		switch r.URL.Path {
		case "/api/v2/user":
			_, _ = w.Write([]byte(`{"id":1,"username":"fixture","settings":{"timezone":"UTC"}}`))
		case "/api/v2/tasks":
			query := r.URL.Query()
			filter := "done = true && done_at >= '2026-10-02T00:00:00Z' && done_at <= '" +
				now.Format(time.RFC3339) + "'"
			if query.Get("per_page") != "100" || query.Get("expand") != "" ||
				query.Get("filter_timezone") != "UTC" || query.Get("filter") != filter {
				t.Error("unexpected filter, page size or expanded task data")
			}
			writeActivityPage(t, w, r, pageSize, total)
		default:
			t.Errorf("unexpected per-task or metadata request: %s", r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	baseURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	client := vikunja.NewClient(baseURL, "fixture-only")
	t.Cleanup(client.CloseIdleConnections)
	cache := service.NewPublicActivity(client, func() time.Time { return now })
	started := time.Now()
	readActivityTogether(t, cache, total)
	firstRequests := int64(1 + total/pageSize)
	if requests.Load() != firstRequests {
		t.Fatalf("requests = %d, want %d for %d tasks", requests.Load(), firstRequests, total)
	}
	t.Logf("%d tasks, page size %d, 30 concurrent readers: %d HTTP requests, elapsed %s",
		total, pageSize, requests.Load(), time.Since(started))
	now = now.Add(time.Hour - time.Nanosecond)
	readActivityTogether(t, cache, total)
	if requests.Load() != firstRequests {
		t.Fatal("cache hits repeated the upstream scan")
	}
	now = now.Add(time.Nanosecond)
	readActivityTogether(t, cache, total)
	if requests.Load() != 2*firstRequests {
		t.Fatalf("hourly refresh requests = %d, want %d", requests.Load(), 2*firstRequests)
	}
}

func writeActivityPage(t *testing.T, w http.ResponseWriter, r *http.Request, pageSize, total int) {
	t.Helper()
	page, err := strconv.Atoi(r.URL.Query().Get("page"))
	if err != nil || page < 1 || page > total/pageSize {
		t.Error("invalid page")
		http.Error(w, "invalid page", http.StatusBadRequest)
		return
	}
	instant := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
	items := make([]vikunja.ActivityTask, pageSize)
	for index := range items {
		items[index] = vikunja.ActivityTask{Done: true, DoneAt: instant}
		position := (page-1)*pageSize + index
		switch position % 4 {
		case 0, 1:
			items[index].DueDate = instant
		case 2:
			items[index].DueDate = instant.Add(-time.Hour)
		}
	}
	if err := json.NewEncoder(w).Encode(struct {
		Items      []vikunja.ActivityTask `json:"items"`
		Page       int                    `json:"page"`
		PerPage    int                    `json:"per_page"`
		Total      int                    `json:"total"`
		TotalPages int                    `json:"total_pages"`
	}{items, page, pageSize, total, total / pageSize}); err != nil {
		t.Error(err)
	}
}

func readActivityTogether(t *testing.T, cache *service.PublicActivity, total int) {
	t.Helper()
	var readers sync.WaitGroup
	for range 30 {
		readers.Go(func() {
			summary, err := cache.Read(t.Context())
			if err != nil {
				t.Error(err)
				return
			}
			day := summary.Days[13]
			if summary.Total != total || day.OnTimeCount != total/2 || day.WithDeadlineCount != total*3/4 {
				t.Errorf("incorrect large-dataset aggregate: %+v", day)
			}
		})
	}
	readers.Wait()
}
