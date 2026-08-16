package integration

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestJobsHandlerRejectsUnsafeRequests(t *testing.T) {
	t.Parallel()

	handler := newTestJobsHandler(
		t,
		"https://vikunja.example.test",
		func() time.Time { return time.Date(2026, time.August, 16, 12, 0, 0, 0, time.UTC) },
	)
	testCases := []struct {
		name          string
		method        string
		target        string
		authorization string
		wantStatus    int
	}{
		{name: "post", method: http.MethodPost, target: "/integrations/v1/jobs", authorization: "Bearer tk_valid", wantStatus: http.StatusMethodNotAllowed},
		{name: "missing token", method: http.MethodGet, target: "/integrations/v1/jobs", wantStatus: http.StatusUnauthorized},
		{name: "wrong scheme", method: http.MethodGet, target: "/integrations/v1/jobs", authorization: "Basic abc", wantStatus: http.StatusUnauthorized},
		{name: "empty bearer", method: http.MethodGet, target: "/integrations/v1/jobs", authorization: "Bearer ", wantStatus: http.StatusUnauthorized},
		{name: "invalid page", method: http.MethodGet, target: "/integrations/v1/jobs?page=0", authorization: "Bearer tk_valid", wantStatus: http.StatusBadRequest},
		{name: "oversized page", method: http.MethodGet, target: "/integrations/v1/jobs?pageSize=101", authorization: "Bearer tk_valid", wantStatus: http.StatusBadRequest},
		{name: "empty label", method: http.MethodGet, target: "/integrations/v1/jobs?label=", authorization: "Bearer tk_valid", wantStatus: http.StatusBadRequest},
		{name: "malformed query", method: http.MethodGet, target: "/integrations/v1/jobs?page=1;pageSize=2", authorization: "Bearer tk_valid", wantStatus: http.StatusBadRequest},
		{name: "unknown parameter", method: http.MethodGet, target: "/integrations/v1/jobs?scope=week", authorization: "Bearer tk_valid", wantStatus: http.StatusBadRequest},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			request := httptest.NewRequestWithContext(t.Context(), testCase.method, testCase.target, nil)
			request.Header.Set("Authorization", testCase.authorization)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			if recorder.Code != testCase.wantStatus {
				t.Fatalf("status = %d, want %d; body = %q", recorder.Code, testCase.wantStatus, recorder.Body.String())
			}
			if recorder.Header().Get("Content-Type") != "application/json; charset=utf-8" {
				t.Fatalf("content type = %q", recorder.Header().Get("Content-Type"))
			}
		})
	}
}

func TestJobsHandlerReturnsFilteredJobsUsingCallerToken(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 16, 12, 0, 0, 0, time.UTC)
	dueAt := now.Add(2 * time.Hour)
	var requestCount atomic.Int64
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
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
				{"id": 4, "title": "job"},
				{"id": 8, "title": "dashboard"},
			})
		case "/api/v2/tasks":
			if filter := request.URL.Query().Get("filter"); filter != "done = false && labels in 4 && repeat_after = 0" {
				t.Errorf("filter = %q", filter)
			}
			writeTestPage(t, writer, []map[string]any{
				{
					"id": 1, "title": "Hidden job", "project_id": 7,
					"labels": []map[string]any{{"id": 4, "title": "job"}},
				},
				{
					"id": 2, "title": "Visible job", "description": "Shown in Glance", "project_id": 7,
					"priority": 3, "due_date": dueAt, "start_date": now.Add(time.Hour),
					"labels": []map[string]any{{"id": 4, "title": "job"}, {"id": 8, "title": "dashboard"}},
				},
			})
		default:
			t.Errorf("unexpected upstream path %q", request.URL.Path)
			http.NotFound(writer, request)
		}
	}))
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
		Items []struct {
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
		} `json:"items"`
		Page       int   `json:"page"`
		PageSize   int   `json:"pageSize"`
		TotalItems int   `json:"totalItems"`
		TotalPages int   `json:"totalPages"`
		HasMore    bool  `json:"hasMore"`
		IsComplete bool  `json:"isComplete"`
		Issues     []any `json:"issues"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Items) != 1 {
		t.Fatalf("items = %#v", response.Items)
	}
	item := response.Items[0]
	if item.ID != "2" || item.Title != "Visible job" || item.Priority != "HIGH" || item.DueAt == nil ||
		!item.DueAt.Equal(dueAt) || !item.HasDueTime || item.IsOverdue || item.Timezone != "UTC" ||
		item.URL != "https://tasks.example.test/tasks/2" || item.Project.ID != "7" || item.Project.Title != "Home" {
		t.Fatalf("item = %#v", item)
	}
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

func TestJobsHandlerLoadsProjectsAndLabelsConcurrently(t *testing.T) {
	t.Parallel()

	started := make(chan string, 2)
	release := make(chan struct{})
	var releaseOnce sync.Once
	releaseCalls := func() { releaseOnce.Do(func() { close(release) }) }
	defer releaseCalls()

	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v2/user":
			writeTestJSON(t, writer, map[string]any{
				"id": 1, "username": "dashboard", "settings": map[string]any{"timezone": "UTC", "week_start": 1},
			})
		case "/api/v2/projects":
			started <- "projects"
			<-release
			writeTestPage(t, writer, []map[string]any{{"id": 7, "title": "Home"}})
		case "/api/v2/labels":
			started <- "labels"
			<-release
			writeTestPage(t, writer, []map[string]any{{"id": 4, "title": "job"}})
		case "/api/v2/tasks":
			writeTestJSON(t, writer, map[string]any{
				"items": []map[string]any{}, "total": 0, "page": 1, "per_page": 1000, "total_pages": 0,
			})
		default:
			http.NotFound(writer, request)
		}
	}))
	defer upstream.Close()

	handler := newTestJobsHandler(t, upstream.URL, time.Now)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/integrations/v1/jobs", nil)
	request.Header.Set("Authorization", "Bearer tk_glance")
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		handler.ServeHTTP(recorder, request)
		close(done)
	}()

	seen := map[string]bool{<-started: true}
	timer := time.NewTimer(200 * time.Millisecond)
	select {
	case name := <-started:
		seen[name] = true
	case <-timer.C:
	}
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	releaseCalls()
	<-done

	if !seen["projects"] || !seen["labels"] {
		t.Fatalf("calls did not overlap: started = %v", seen)
	}
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; body = %q", recorder.Code, recorder.Body.String())
	}
}

func TestJobsHandlerMapsVikunjaAuthorizationErrors(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name           string
		upstreamStatus int
		wantStatus     int
		wantCode       string
	}{
		{name: "invalid token", upstreamStatus: http.StatusUnauthorized, wantStatus: http.StatusUnauthorized, wantCode: "UNAUTHENTICATED"},
		{name: "insufficient permissions", upstreamStatus: http.StatusForbidden, wantStatus: http.StatusForbidden, wantCode: "FORBIDDEN"},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.WriteHeader(testCase.upstreamStatus)
			}))
			defer upstream.Close()
			handler := newTestJobsHandler(t, upstream.URL, time.Now)
			request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/integrations/v1/jobs", nil)
			request.Header.Set("Authorization", "Bearer tk_not_in_response")
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			if recorder.Code != testCase.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, testCase.wantStatus)
			}
			body := recorder.Body.String()
			var response errorResponse
			if err := json.Unmarshal([]byte(body), &response); err != nil {
				t.Fatal(err)
			}
			if response.Error.Code != testCase.wantCode {
				t.Fatalf("error = %#v", response.Error)
			}
			if strings.Contains(body, "tk_not_in_response") {
				t.Fatal("response exposed the Vikunja token")
			}
		})
	}
}

func TestJobsHandlerReturnsEmptyPageForUnknownLabel(t *testing.T) {
	t.Parallel()

	var requestCount atomic.Int64
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestCount.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v2/user":
			writeTestJSON(t, writer, map[string]any{
				"id": 1, "username": "dashboard",
				"settings": map[string]any{"timezone": "UTC", "week_start": 1},
			})
		case "/api/v2/projects":
			writeTestPage(t, writer, []map[string]any{{"id": 7, "title": "Home"}})
		case "/api/v2/labels":
			writeTestPage(t, writer, []map[string]any{{"id": 4, "title": "job"}})
		default:
			t.Errorf("unexpected upstream path %q", request.URL.Path)
			http.NotFound(writer, request)
		}
	}))
	defer upstream.Close()
	handler := newTestJobsHandler(t, upstream.URL, time.Now)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/integrations/v1/jobs?label=missing", nil)
	request.Header.Set("Authorization", "Bearer tk_glance")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; body = %q", recorder.Code, recorder.Body.String())
	}
	var response jobsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Items) != 0 || response.TotalItems != 0 || !response.IsComplete {
		t.Fatalf("response = %#v", response)
	}
	if got := requestCount.Load(); got != 3 {
		t.Fatalf("upstream requests = %d, want 3", got)
	}
}

func writeTestPage(t *testing.T, writer http.ResponseWriter, items []map[string]any) {
	t.Helper()
	writeTestJSON(t, writer, map[string]any{
		"items": items, "total": len(items), "page": 1, "per_page": 1000, "total_pages": 1,
	})
}

func writeTestJSON(t *testing.T, writer http.ResponseWriter, value any) {
	t.Helper()
	if err := json.NewEncoder(writer).Encode(value); err != nil {
		t.Error(err)
	}
}

func newTestJobsHandler(t *testing.T, upstream string, now func() time.Time) http.Handler {
	t.Helper()
	upstreamURL, err := url.Parse(upstream)
	if err != nil {
		t.Fatal(err)
	}
	return NewJobsHandler(
		upstreamURL,
		&url.URL{Scheme: "https", Host: "tasks.example.test"},
		slog.New(slog.NewTextHandler(io.Discard, nil)),
		now,
	)
}
