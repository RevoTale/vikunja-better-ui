package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestJobsHandlerReturnsFilteredJobsUsingCallerToken(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 16, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(2 * time.Hour)
	var requestCount atomic.Int64
	upstream := httptest.NewServer(filteredJobsUpstream(t, now, dueAt, &requestCount))
	defer upstream.Close()
	handler := newTestJobsHandler(t, upstream.URL, func() time.Time { return now })
	request := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet, "/integrations/v1/jobs?label=dashboard&page=1&pageSize=1", nil,
	)
	request.Header.Set("Authorization", "Bearer tk_glance")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; body = %q", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Items      []jobSummary `json:"items"`
		Page       int          `json:"page"`
		PageSize   int          `json:"pageSize"`
		TotalItems int          `json:"totalItems"`
		TotalPages int          `json:"totalPages"`
		HasMore    bool         `json:"hasMore"`
		IsComplete bool         `json:"isComplete"`
		Issues     []any        `json:"issues"`
	}
	body := recorder.Body.Bytes()
	if err := json.Unmarshal(body, &response); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), "\"doneAt\":null") {
		t.Fatalf("active response does not contain nullable doneAt: %q", body)
	}
	if len(response.Items) != 1 {
		t.Fatalf("items = %#v", response.Items)
	}
	assertVisibleJob(t, response.Items[0], dueAt)
	if response.Page != 1 || response.PageSize != 1 || response.TotalItems != 1 || response.TotalPages != 1 ||
		response.HasMore || !response.IsComplete || len(response.Issues) != 0 {
		t.Fatalf("page = %#v", response)
	}
	if got := requestCount.Load(); got != 4 {
		t.Fatalf("upstream requests = %d, want 4", got)
	}
	if cacheControl := recorder.Header().Get("Cache-Control"); cacheControl != "private, no-store" {
		t.Fatalf("cache control = %q", cacheControl)
	}
}

type jobSummary struct {
	ID         string     `json:"id"`
	Title      string     `json:"title"`
	Priority   string     `json:"priority"`
	DueAt      *time.Time `json:"dueAt"`
	HasDueTime bool       `json:"hasDueTime"`
	IsOverdue  bool       `json:"isOverdue"`
	Timezone   string     `json:"timezone"`
	URL        string     `json:"url"`
	Project    struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	} `json:"project"`
}

func assertVisibleJob(t *testing.T, item jobSummary, dueAt time.Time) {
	t.Helper()
	if item.ID != "2" || item.Title != "Visible job" || item.Priority != "HIGH" || item.DueAt == nil ||
		!item.DueAt.Equal(dueAt) || !item.HasDueTime || item.IsOverdue || item.Timezone != "UTC" ||
		item.URL != "https://tasks.example.test/tasks/2" || item.Project.ID != "7" || item.Project.Title != "Home" {
		t.Fatalf("item = %#v", item)
	}
}

func filteredJobsUpstream(t *testing.T, now, dueAt time.Time, requestCount *atomic.Int64) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestCount.Add(1)
		if got := request.Header.Get("Authorization"); got != "Bearer tk_glance" {
			t.Errorf("authorization = %q", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v2/user":
			writeTestJSON(t, writer, map[string]any{
				"id": 1, "username": "dashboard", "settings": map[string]any{
					"timezone": "UTC", "week_start": 1, "default_project_id": 7,
				},
			})
		case "/api/v2/projects":
			writeTestPage(t, writer, []map[string]any{{"id": 7, "title": "Home"}})
		case "/api/v2/labels":
			writeTestPage(t, writer, []map[string]any{
				{"id": 4, "title": "vbu:job"},
				{"id": 9, "title": "job"},
				{"id": 8, "title": "dashboard"},
			})
		case "/api/v2/tasks":
			if filter := request.URL.Query().Get("filter"); filter != "done = false && labels in 4" {
				t.Errorf("filter = %q", filter)
			}
			writeTestPage(t, writer, []map[string]any{
				{
					"id": 3, "title": "Ordinary legacy label", "project_id": 7,
					"labels": []map[string]any{{"id": 9, "title": "job"}, {"id": 8, "title": "dashboard"}},
				},
				{
					"id": 1, "title": "Hidden job", "project_id": 7,
					"labels": []map[string]any{{"id": 4, "title": "vbu:job"}},
				},
				{
					"id": 2, "title": "Visible job", "description": "Shown in Glance", "project_id": 7,
					"priority": 3, "due_date": dueAt, "start_date": now.Add(time.Hour), "done_at": now,
					"repeat_after": 172800, "repeat_mode": 2,
					"labels": []map[string]any{{"id": 4, "title": "vbu:job"}, {"id": 8, "title": "dashboard"}},
				},
			})
		default:
			t.Errorf("unexpected upstream path %q", request.URL.Path)
			http.NotFound(writer, request)
		}
	})
}
