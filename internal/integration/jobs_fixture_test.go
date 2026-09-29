package integration

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"testing"
	"time"
)

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
		slog.New(slog.DiscardHandler),
		now,
	)
}
