package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestJobsHandlerReturnsUnifiedJobsWithDerivedFinishTime(t *testing.T) {
	t.Parallel()

	completedFrom := time.Date(2026, time.August, 24, 0, 0, 0, 0, time.UTC)
	activeDueAt := completedFrom.Add(6 * 24 * time.Hour)
	completedAt := completedFrom.Add(4 * 24 * time.Hour)
	upstream := httptest.NewServer(unifiedJobsUpstream(t, completedFrom, activeDueAt, completedAt))
	defer upstream.Close()

	handler := newTestJobsHandler(t, upstream.URL, func() time.Time { return completedFrom })
	request := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet,
		"/integrations/v1/jobs?status=all&completedFrom=2026-08-24T00%3A00%3A00Z"+
			"&completedBefore=2026-08-31T00%3A00%3A00Z&sortBy=finishAt&sortOrder=desc",
		nil,
	)
	request.Header.Set("Authorization", "Bearer tk_glance")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; body = %q", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Items []struct {
			ID       string     `json:"id"`
			DueAt    *time.Time `json:"dueAt"`
			DoneAt   *time.Time `json:"doneAt"`
			FinishAt *time.Time `json:"finishAt"`
		} `json:"items"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Items) != 2 || response.Items[0].ID != "10" || response.Items[1].ID != "12" {
		t.Fatalf("items = %#v", response.Items)
	}
	if response.Items[0].FinishAt == nil || !response.Items[0].FinishAt.Equal(activeDueAt) ||
		response.Items[1].FinishAt == nil || !response.Items[1].FinishAt.Equal(completedAt) {
		t.Fatalf("items = %#v", response.Items)
	}
}

func unifiedJobsUpstream(t *testing.T, completedFrom, activeDueAt, completedAt time.Time) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
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
			writeTestPage(t, writer, []map[string]any{{"id": 4, "title": "vbu:job"}})
		case "/api/v2/tasks":
			if strings.HasPrefix(request.URL.Query().Get("filter"), "done = true") {
				writeTestPage(t, writer, []map[string]any{{
					"id": 12, "title": "Completed", "project_id": 7, "done": true, "done_at": completedAt,
					"due_date": completedFrom.Add(5 * 24 * time.Hour),
					"labels":   []map[string]any{{"id": 4, "title": "vbu:job"}},
				}})
				return
			}
			writeTestPage(t, writer, []map[string]any{{
				"id": 10, "title": "Active", "project_id": 7, "due_date": activeDueAt,
				"labels": []map[string]any{{"id": 4, "title": "vbu:job"}},
			}})
		default:
			http.NotFound(writer, request)
		}
	})
}
