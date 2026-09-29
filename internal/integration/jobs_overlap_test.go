package integration

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestJobsHandlerDoesNotWaitForProjectsBeforeLoadingTasks(t *testing.T) {
	t.Parallel()

	started := make(chan string, 4)
	releaseProjects := make(chan struct{})
	var releaseOnce sync.Once
	releaseCalls := func() { releaseOnce.Do(func() { close(releaseProjects) }) }
	defer releaseCalls()

	upstream := httptest.NewServer(overlappingJobsUpstream(t, started, releaseProjects))
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

	seen := make(map[string]bool, 4)
	timer := time.NewTimer(200 * time.Millisecond)
	for !seen["user"] || !seen["projects"] || !seen["labels"] {
		select {
		case name := <-started:
			seen[name] = true
		case <-timer.C:
			releaseCalls()
			<-done
			t.Fatalf("metadata calls did not overlap: started = %v", seen)
		}
	}
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	if !seen["tasks"] {
		select {
		case name := <-started:
			seen[name] = true
		case <-time.After(200 * time.Millisecond):
			releaseCalls()
			<-done
			t.Fatalf("tasks waited for projects: started = %v", seen)
		}
	}
	releaseCalls()
	<-done

	if !seen["tasks"] {
		t.Fatalf("tasks did not start while projects were loading: started = %v", seen)
	}
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; body = %q", recorder.Code, recorder.Body.String())
	}
}

func overlappingJobsUpstream(t *testing.T, started chan<- string, releaseProjects <-chan struct{}) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v2/user":
			started <- "user"
			writeTestJSON(t, writer, map[string]any{
				"id": 1, "username": "dashboard", "settings": map[string]any{"timezone": "UTC", "week_start": 1},
			})
		case "/api/v2/projects":
			started <- "projects"
			<-releaseProjects
			writeTestPage(t, writer, []map[string]any{{"id": 7, "title": "Home"}})
		case "/api/v2/labels":
			started <- "labels"
			writeTestPage(t, writer, []map[string]any{{"id": 4, "title": "vbu:job"}})
		case "/api/v2/tasks":
			started <- "tasks"
			writeTestJSON(t, writer, map[string]any{
				"items": []map[string]any{}, "total": 0, "page": 1, "per_page": 1000, "total_pages": 0,
			})
		default:
			http.NotFound(writer, request)
		}
	})
}
