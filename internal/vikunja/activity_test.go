package vikunja

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestActivityPageUsesFilteredMinimalTaskCollection(t *testing.T) {
	t.Parallel()
	filter := "done = true && done_at >= '2026-10-01T00:00:00Z'"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		if r.URL.Path != "/api/v2/tasks" || r.Method != http.MethodGet ||
			query.Get("filter") != filter || query.Get("filter_timezone") != "UTC" ||
			query.Get("expand") != "" || query.Get("sort_by") != "id" || query.Get("order_by") != ascendingOrder {
			t.Errorf("unexpected activity request: %s %s", r.Method, r.URL)
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Error("missing upstream authentication")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"items":[{"done":true,"done_at":"2026-10-02T12:00:00Z",
			"priority":2,"description":"private","labels":[{"title":"vbu:skipped"}]}],
			"page":1,"per_page":100,"total":1,"total_pages":1}`))
	}))
	t.Cleanup(server.Close)
	result, err := testClient(t, server.URL, "test-token").ActivityPage(t.Context(), TaskQuery{
		Page: 1, PerPage: 100, Filter: filter, FilterTimezone: "UTC",
	})
	if err != nil || len(result.Items) != 1 || result.Items[0].Priority != 2 || !result.Items[0].Done {
		t.Fatalf("activity: %+v, %v", result, err)
	}
}
