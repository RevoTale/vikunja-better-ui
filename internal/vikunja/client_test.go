package vikunja

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
)

func TestClientLogsSafeUpstreamTiming(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"id":42}`))
	}))
	t.Cleanup(server.Close)

	baseURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, &slog.HandlerOptions{Level: slog.LevelDebug}))
	client := NewClient(baseURL, "secret-token", WithLogger(logger))
	query := url.Values{"filter": {"secret-filter"}}
	if _, err := client.doJSONWithQuery(
		context.Background(), http.MethodGet, "tasks/42", query, nil, "", &struct{}{},
	); err != nil {
		t.Fatalf("doJSONWithQuery() error = %v", err)
	}

	entry := logs.String()
	for _, expected := range []string{`"msg":"Vikunja request completed"`, `"resource":"tasks"`, `"duration_ms":`} {
		if !strings.Contains(entry, expected) {
			t.Fatalf("log entry %q does not contain %q", entry, expected)
		}
	}
	for _, secret := range []string{"secret-token", "secret-filter", "tasks/42"} {
		if strings.Contains(entry, secret) {
			t.Fatalf("log entry exposed %q: %s", secret, entry)
		}
	}
}

func TestClientDoJSONUsesV2AndBearerToken(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/base/api/v2/tasks/42" {
			t.Errorf("request path = %q", request.URL.Path)
		}
		if got := request.Header.Get("Authorization"); got != "Bearer test-token" {
			t.Errorf("Authorization = %q", got)
		}
		if got := request.Header.Get("Accept"); got != "application/json" {
			t.Errorf("Accept = %q", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		writer.Header().Set("ETag", `"version-1"`)
		_, _ = writer.Write([]byte(`{"id":42}`))
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL+"/base", "test-token")
	var result struct {
		ID int64 `json:"id"`
	}
	metadata, err := client.doJSON(context.Background(), http.MethodGet, "tasks/42", nil, "", &result)
	if err != nil {
		t.Fatalf("doJSON() error = %v", err)
	}
	if result.ID != 42 || metadata.ETag != `"version-1"` {
		t.Fatalf("result/metadata = %#v/%#v", result, metadata)
	}
}

func TestClientDoJSONSendsConditionalWrite(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("If-Match"); got != `"version-1"` {
			t.Errorf("If-Match = %q", got)
		}
		if got := request.Header.Get("Content-Type"); got != "application/json" {
			t.Errorf("Content-Type = %q", got)
		}
		var body map[string]bool
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Errorf("decode request: %v", err)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"done":true}`))
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	var result map[string]bool
	_, err := client.doJSON(
		context.Background(),
		http.MethodPatch,
		"tasks/42",
		map[string]bool{"done": true},
		`"version-1"`,
		&result,
	)
	if err != nil {
		t.Fatalf("doJSON() error = %v", err)
	}
	if !result["done"] {
		t.Fatal("decoded result did not contain done=true")
	}
}

func TestClientDoesNotFollowRedirects(t *testing.T) {
	t.Parallel()

	var redirectedRequests atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		redirectedRequests.Add(1)
	}))
	t.Cleanup(target.Close)

	source := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		http.Redirect(writer, request, target.URL, http.StatusTemporaryRedirect)
	}))
	t.Cleanup(source.Close)

	client := testClient(t, source.URL, "secret-token")
	_, err := client.doJSON(context.Background(), http.MethodGet, "user", nil, "", &struct{}{})
	var upstreamErr *Error
	if !errors.As(err, &upstreamErr) || upstreamErr.Status != http.StatusTemporaryRedirect {
		t.Fatalf("doJSON() error = %v, want safe redirect error", err)
	}
	if got := redirectedRequests.Load(); got != 0 {
		t.Fatalf("redirect target received %d requests", got)
	}
}

func TestClientRejectsUnexpectedResponseContentType(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "text/html")
		_, _ = writer.Write([]byte(`<p>secret upstream details</p>`))
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	_, err := client.doJSON(context.Background(), http.MethodGet, "user", nil, "", &struct{}{})
	if err == nil {
		t.Fatal("doJSON() error = nil, want content-type error")
	}
	if strings.Contains(err.Error(), "secret upstream details") {
		t.Fatalf("doJSON() exposed response body: %v", err)
	}
}

func TestClientRejectsTrailingJSONValues(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"id":1}{"id":2}`))
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	_, err := client.doJSON(context.Background(), http.MethodGet, "user", nil, "", &struct{}{})
	if err == nil {
		t.Fatal("doJSON() error = nil, want trailing JSON rejection")
	}
}

func TestClientRejectsResponseBodyOverLimit(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"value":"` + strings.Repeat("x", maxResponseBodyBytes) + `"}`))
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	_, err := client.doJSON(context.Background(), http.MethodGet, "user", nil, "", &struct{}{})
	if err == nil {
		t.Fatal("doJSON() error = nil, want oversized response rejection")
	}
}

func testClient(t *testing.T, rawURL string, token string) *Client {
	t.Helper()

	baseURL, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("url.Parse() error = %v", err)
	}
	return NewClient(baseURL, token)
}
