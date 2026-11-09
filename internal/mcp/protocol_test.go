package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestDiscoveryPublishesSchemasAndIntentAnnotations(t *testing.T) {
	t.Parallel()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	defer upstream.Close()
	response := callProtocol(testHandler(t, upstream.URL), "tk_fixture", `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)
	var body struct {
		Result struct {
			Tools []struct {
				Name        string          `json:"name"`
				Description string          `json:"description"`
				Input       json.RawMessage `json:"inputSchema"`
				Output      json.RawMessage `json:"outputSchema"`
				Annotations struct {
					ReadOnly bool `json:"readOnlyHint"`
				} `json:"annotations"`
			} `json:"tools"`
		} `json:"result"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Result.Tools) != 23 {
		t.Fatalf("unexpected surface: %d tools", len(body.Result.Tools))
	}
	for _, tool := range body.Result.Tools {
		if tool.Description == "" || len(tool.Input) == 0 || len(tool.Output) == 0 {
			t.Errorf("undocumented tool %s", tool.Name)
		}
		read := strings.HasPrefix(tool.Name, "get_") || strings.HasPrefix(tool.Name, "list_") ||
			tool.Name == "explain_concept"
		if tool.Annotations.ReadOnly != read {
			t.Errorf("wrong effects for %s", tool.Name)
		}
		if tool.Name == "list_tasks" && !strings.Contains(string(tool.Input), `"enum"`) {
			t.Error("scope choices missing")
		}
	}
	t.Logf("discovery JSON: %d bytes for %d tools", response.Body.Len(), len(body.Result.Tools))
}

func TestUnknownScopeRejectedBeforeTaskRead(t *testing.T) {
	t.Parallel()
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/api/v2/mcp" {
			t.Errorf("invalid arguments reached %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer upstream.Close()
	response := callProtocol(testHandler(t, upstream.URL), "tk_fixture",
		`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_tasks","arguments":{"scope":"EVERYTHING"}}}`)
	if !strings.Contains(response.Body.String(), `"isError":true`) || calls.Load() != 1 {
		t.Fatalf("invalid scope accepted: %s", response.Body)
	}
}

func TestOldProtocolRetainsHTTPRequestCancellation(t *testing.T) {
	t.Parallel()
	entered := make(chan struct{})
	upstreamDone := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v2/mcp" {
			w.WriteHeader(http.StatusAccepted)
			return
		}
		close(entered)
		<-r.Context().Done()
		close(upstreamDone)
	}))
	defer upstream.Close()
	handler := testHandler(t, upstream.URL)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	request := httptest.NewRequestWithContext(ctx, http.MethodPost, "http://localhost/mcp", strings.NewReader(
		`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_task","arguments":{"taskId":1}}}`))
	request.Header.Set("Authorization", "Bearer tk_fixture")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json, text/event-stream")
	request.Header.Set("Mcp-Protocol-Version", "2025-11-25")
	done := make(chan struct{})
	go func() { handler.ServeHTTP(httptest.NewRecorder(), request); close(done) }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("upstream read did not begin")
	}
	cancel()
	select {
	case <-upstreamDone:
	case <-time.After(time.Second):
		t.Fatal("upstream ignored caller cancellation")
	}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("MCP handler remained running")
	}
}
