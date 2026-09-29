package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"
)

func TestJobsHandlerReturnsCompletedJobsByCompletionTime(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 28, 18, 30, 0, 0, time.FixedZone("EEST", 3*60*60))
	upstream := httptest.NewServer(completedJobsUpstream(t, completedAt))
	defer upstream.Close()

	handler := newTestJobsHandler(t, upstream.URL, time.Now)
	request := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet,
		"/integrations/v1/jobs?status=completed&completedFrom=2026-08-24T00%3A00%3A00%2B03%3A00"+
			"&completedBefore=2026-08-31T00%3A00%3A00%2B03%3A00&label=dashboard",
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
			ID     string     `json:"id"`
			DoneAt *time.Time `json:"doneAt"`
		} `json:"items"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Items) != 1 || response.Items[0].ID != "12" || response.Items[0].DoneAt == nil ||
		!response.Items[0].DoneAt.Equal(completedAt) {
		t.Fatalf("items = %#v", response.Items)
	}
}

func completedJobsUpstream(t *testing.T, completedAt time.Time) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v2/user":
			writeTestJSON(t, writer, map[string]any{
				"id": 1, "username": "dashboard", "settings": map[string]any{
					"timezone": "Europe/Kyiv", "week_start": 1, "default_project_id": 7,
				},
			})
		case "/api/v2/projects":
			writeTestPage(t, writer, []map[string]any{{"id": 7, "title": "Home"}})
		case "/api/v2/labels":
			writeTestPage(t, writer, []map[string]any{
				{"id": 4, "title": "vbu:job"},
				{"id": 8, "title": "dashboard"},
			})
		case "/api/v2/tasks":
			wantFilter := "done = true && done_at >= '2026-08-24T00:00:00+03:00' && " +
				"done_at < '2026-08-31T00:00:00+03:00' && labels in 4 && repeat_after = 0"
			if filter := request.URL.Query().Get("filter"); filter != wantFilter {
				t.Errorf("filter = %q", filter)
			}
			if got := request.URL.Query()["sort_by"]; !slices.Equal(got, []string{"done_at", "id"}) {
				t.Errorf("sort_by = %v", got)
			}
			if got := request.URL.Query()["order_by"]; !slices.Equal(got, []string{"desc", "desc"}) {
				t.Errorf("order_by = %v", got)
			}
			writeTestPage(t, writer, []map[string]any{{
				"id": 12, "title": "Finished job", "project_id": 7, "done": true, "done_at": completedAt,
				"labels": []map[string]any{{"id": 4, "title": "vbu:job"}, {"id": 8, "title": "dashboard"}},
			}})
		default:
			t.Errorf("unexpected upstream path %q", request.URL.Path)
			http.NotFound(writer, request)
		}
	})
}
