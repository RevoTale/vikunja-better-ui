package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPreviewDateSkipsNoOpAndVerifiesRestoration(t *testing.T) {
	t.Parallel()
	want := time.Date(2026, time.October, 15, 12, 0, 0, 0, time.UTC)
	for _, scenario := range []struct {
		name              string
		created, returned time.Time
		calls             int
		valid             bool
	}{
		{"already preserved", want, want, 0, true},
		{"needs restoration", want.Add(time.Hour), want, 1, true},
		{"restore rejected", want.Add(time.Hour), want.Add(time.Hour), 1, false},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			t.Parallel()
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if r.Method != http.MethodPatch || r.URL.Path != "/api/v2/tasks/42" {
					t.Error("unexpected restore request")
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(fixtureEntity{ID: 42, DoneAt: scenario.returned})
			}))
			t.Cleanup(server.Close)
			api := &fixtureAPI{baseURL: server.URL}
			err := api.restorePreviewDate(t.Context(), fixtureEntity{ID: 42, DoneAt: scenario.created}, want)
			if (err == nil) != scenario.valid || calls != scenario.calls {
				t.Fatalf("calls=%d err=%v", calls, err)
			}
		})
	}
}
