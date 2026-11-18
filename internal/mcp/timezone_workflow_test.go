package mcp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestBotFallbackCreationUsesLocalDeadlineAcrossDST(t *testing.T) {
	t.Parallel()
	for _, test := range []struct{ date, instant string }{
		{"2026-03-28", "2026-03-28T10:00:00Z"},
		{"2026-03-29", "2026-03-29T09:00:00Z"},
	} {
		t.Run(test.date, func(t *testing.T) {
			t.Parallel()
			writes := make(chan vikunja.TaskWrite, 1)
			var profiles atomic.Int32
			upstream := timezoneCreationServer(t, test.instant, writes, &profiles)
			response := callProtocol(fallbackHandler(t, upstream.URL, "Europe/Kyiv"), "tk_bot",
				`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_one_time_task",`+
					`"arguments":{"projectId":1,"title":"Timed","dueDate":"`+test.date+`","dueTime":"12:00"}}}`)
			if !strings.Contains(response.Body.String(), `"status":"CONFIRMED"`) || profiles.Load() != 1 {
				t.Fatalf("creation not confirmed or redundant profile read: %s; reads=%d", response.Body, profiles.Load())
			}
			select {
			case write := <-writes:
				if write.DueDate.UTC().Format(time.RFC3339) != test.instant || write.Title != "Timed" {
					t.Fatalf("wrong native deadline: %+v", write)
				}
			default:
				t.Fatal("task was not created")
			}
		})
	}
}

func timezoneCreationServer(
	t *testing.T, instant string, writes chan<- vikunja.TaskWrite, profiles *atomic.Int32,
) *httptest.Server {
	t.Helper()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tk_bot" {
			t.Error("caller token was not preserved")
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.Method + " " + r.URL.Path {
		case "POST /api/v2/mcp":
			w.WriteHeader(http.StatusAccepted)
		case "GET /api/v2/user":
			profiles.Add(1)
			_, _ = w.Write([]byte(`{"id":2,"username":"bot-fixture","bot_owner_id":1,"settings":{"timezone":""}}`))
		case "GET /api/v2/projects":
			_, _ = w.Write([]byte(`{"items":[{"id":1}],"page":1,"per_page":1000,"total":1,"total_pages":1}`))
		case "POST /api/v2/projects/1/tasks":
			var write vikunja.TaskWrite
			if err := json.NewDecoder(r.Body).Decode(&write); err != nil {
				t.Error(err)
			}
			writes <- write
			_, _ = w.Write([]byte(`{"id":1,"project_id":1,"title":"Timed","due_date":"` + instant + `"}`))
		case "GET /api/v2/tasks/1":
			_, _ = w.Write([]byte(`{"id":1,"project_id":1,"title":"Timed","due_date":"` + instant + `"}`))
		default:
			t.Errorf("unexpected upstream operation: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusForbidden)
		}
	}))
	t.Cleanup(upstream.Close)
	return upstream
}

func TestBotFallbackDoesNotBypassProfilePermission(t *testing.T) {
	t.Parallel()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v2/mcp" {
			w.WriteHeader(http.StatusAccepted)
			return
		}
		if r.URL.Path != "/api/v2/user" {
			t.Errorf("profile failure reached %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusForbidden)
	}))
	t.Cleanup(upstream.Close)
	response := callProtocol(fallbackHandler(t, upstream.URL, "Europe/Kyiv"), "tk_bot",
		`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_context","arguments":{}}}`)
	if !strings.Contains(response.Body.String(), `"isError":true`) ||
		!strings.Contains(response.Body.String(), "Cannot read the token owner's profile") {
		t.Fatalf("fallback bypassed profile permissions: %s", response.Body)
	}
}
