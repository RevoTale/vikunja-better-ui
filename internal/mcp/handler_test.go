package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestDiscoveryUsesCallerTokenWithoutReadingTasks(t *testing.T) {
	t.Parallel()
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/api/v2/mcp" || r.Header.Get("Authorization") != "Bearer tk_readonly" {
			t.Errorf("unexpected request %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer upstream.Close()
	handler := testHandler(t, upstream.URL)
	response := callProtocol(handler, "tk_readonly", `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "explain_concept") ||
		!strings.Contains(response.Body.String(), "list_tasks") || calls.Load() != 1 {
		t.Fatalf("discovery failed: %d %s; upstream calls %d", response.Code, response.Body, calls.Load())
	}
	if response.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatal("private caching boundary missing")
	}
}

func TestMCPRejectsMissingJWTAndDeniedTokens(t *testing.T) {
	t.Parallel()
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusForbidden)
	}))
	defer upstream.Close()
	handler := testHandler(t, upstream.URL)
	for _, token := range []string{"", "jwt.token", "tk_denied"} {
		response := callProtocol(handler, token, `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)
		want := http.StatusUnauthorized
		if token == "tk_denied" {
			want = http.StatusForbidden
		}
		if response.Code != want {
			t.Fatalf("token category returned %d, want %d", response.Code, want)
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("malformed credentials reached upstream: %d calls", calls.Load())
	}
}

func TestTodayDoesNotBecomeActiveWork(t *testing.T) {
	t.Parallel()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v2/mcp":
			w.WriteHeader(http.StatusAccepted)
		case "/api/v2/user":
			_, _ = w.Write([]byte(`{"id":1,"username":"fixture","settings":{"timezone":"UTC"}}`))
		case "/api/v2/projects":
			_, _ = w.Write([]byte(`{"items":[{"id":1,"title":"Work"}],"page":1,"per_page":1000,"total":1,"total_pages":1}`))
		case "/api/v2/tasks":
			_, _ = w.Write([]byte(`{"items":[
{"id":1,"title":"Finish today","project_id":1,"due_date":"2026-11-09T12:00:00Z"},
{"id":2,"title":"Long plan","project_id":1,
"start_date":"2026-11-01T00:00:00Z","end_date":"2026-11-30T23:59:59Z"}],
"page":1,"per_page":1000,"total":2,"total_pages":1}`))
		default:
			t.Errorf("unexpected upstream path %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer upstream.Close()
	response := callProtocol(testHandler(t, upstream.URL), "tk_readonly",
		`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_tasks","arguments":{"scope":"TODAY"}}}`)
	var result struct {
		Result struct {
			StructuredContent listOutput `json:"structuredContent"`
		} `json:"result"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	items := result.Result.StructuredContent.Items
	if len(items) != 1 || items[0].ID != 1 || !result.Result.StructuredContent.IsComplete {
		t.Fatalf("wrong Today classification: %s", response.Body)
	}
}

func testHandler(t *testing.T, rawURL string) http.Handler {
	t.Helper()
	upstream, err := url.Parse(rawURL)
	if err != nil {
		t.Fatal(err)
	}
	return NewHandler(Options{Upstream: upstream, PublicUpstream: upstream,
		Secret: []byte("fixture-mcp-secret-not-a-real-credential"),
		Now:    func() time.Time { return time.Date(2026, time.November, 9, 9, 0, 0, 0, time.UTC) }})
}

func callProtocol(handler http.Handler, token, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequestWithContext(context.Background(), http.MethodPost,
		"http://localhost/mcp", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json, text/event-stream")
	request.Header.Set("Mcp-Protocol-Version", "2025-11-25")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}
