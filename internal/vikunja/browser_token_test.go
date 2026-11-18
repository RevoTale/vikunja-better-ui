package vikunja

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const (
	probePath    = "/api/v2/token/test"
	scopeFixture = "tk_synthetic_scope_probe"
)

func TestBrowserDeniedOperationsUseIndependentTokenCheckWithoutReplaying(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name string
		call func(context.Context, *Client) error
	}{
		{"JSON write", func(ctx context.Context, client *Client) error { return client.DeleteTask(ctx, 1) }},
		{"profile read", func(ctx context.Context, client *Client) error { _, err := client.CurrentUser(ctx); return err }},
		{"media", func(ctx context.Context, client *Client) error {
			response, err := client.AttachmentContent(ctx, 1, 2, "")
			if response != nil {
				_ = response.Body.Close()
			}
			return err
		}},
		{"avatar", func(ctx context.Context, client *Client) error { _, err := client.Avatar(ctx, "example"); return err }},
		{"upload", func(ctx context.Context, client *Client) error {
			_, err := client.UploadTaskAttachment(ctx, 1, "fixture.txt", strings.NewReader("fixture"))
			return err
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			var originals, probes atomic.Int32
			server := httptest.NewServer(allowedTokenFixture(t, &originals, &probes))
			t.Cleanup(server.Close)
			client := testClient(t, server.URL, "").ForBrowserToken(scopeFixture)
			assertBrowserStatus(t, tc.call(t.Context(), client), http.StatusForbidden)
			if originals.Load() != 1 || probes.Load() != 1 {
				t.Fatalf("original requests=%d, checks=%d", originals.Load(), probes.Load())
			}
		})
	}
}

func allowedTokenFixture(t *testing.T, originals, probes *atomic.Int32) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+scopeFixture {
			t.Error("wrong request credential")
		}
		if r.URL.Path == probePath {
			probes.Add(1)
			if r.Method != http.MethodGet || r.URL.RawQuery != "" {
				t.Error("validity lookup must be a fixed read")
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprint(w, `{"message":"ok"}`)
			return
		}
		originals.Add(1)
		w.WriteHeader(http.StatusUnauthorized)
	})
}

func TestBrowserTokenCheckRejectsOnlyDefinitiveRevocation(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name   string
		status int
		body   string
	}{
		{"revoked", http.StatusUnauthorized, ""}, {"forbidden check", http.StatusForbidden, ""},
		{"rate limited", http.StatusTooManyRequests, ""}, {"outage", http.StatusServiceUnavailable, ""},
		{"missing body", http.StatusNoContent, ""}, {"unexpected JSON", http.StatusOK, `{"message":"other"}`},
		{"invalid JSON", http.StatusOK, "malformed"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			var probes atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != probePath {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				probes.Add(1)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.status)
				_, _ = fmt.Fprint(w, tc.body)
			}))
			t.Cleanup(server.Close)
			client := testClient(t, server.URL, "").ForBrowserToken(scopeFixture)
			err := client.DeleteTask(t.Context(), 1)
			if tc.status == http.StatusUnauthorized {
				assertBrowserStatus(t, err, http.StatusUnauthorized)
			} else if !errors.Is(err, ErrTokenCheckUnavailable) {
				t.Error("unconfirmed credential state must preserve the login")
			}
			if probes.Load() != 1 {
				t.Errorf("expected one credential check, got %d", probes.Load())
			}
		})
	}
}

func TestSuccessfulAndNonBrowserRequestsNeverProbe(t *testing.T) {
	t.Parallel()
	var probes atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == probePath:
			probes.Add(1)
			w.WriteHeader(http.StatusServiceUnavailable)
		case r.Header.Get("Authorization") == "Bearer tk_write":
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusUnauthorized)
		}
	}))
	t.Cleanup(server.Close)
	client := testClient(t, server.URL, "")
	if err := client.ForBrowserToken("tk_write").DeleteTask(t.Context(), 1); err != nil {
		t.Fatal(err)
	}
	for _, scoped := range []*Client{client.ForToken(scopeFixture), client.ForBrowserToken("")} {
		assertBrowserStatus(t, scoped.DeleteTask(t.Context(), 1), http.StatusUnauthorized)
	}
	if probes.Load() != 0 {
		t.Error("unexpected credential check")
	}
}

func TestBrowserTokenCheckNeverFollowsRedirect(t *testing.T) {
	t.Parallel()
	var forwarded atomic.Int32
	other := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		forwarded.Add(1)
	}))
	t.Cleanup(other.Close)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == probePath {
			http.Redirect(w, r, other.URL, http.StatusTemporaryRedirect)
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(server.Close)
	err := testClient(t, server.URL, "").ForBrowserToken(scopeFixture).DeleteTask(t.Context(), 1)
	if !errors.Is(err, ErrTokenCheckUnavailable) || forwarded.Load() != 0 ||
		strings.Contains(err.Error(), scopeFixture) {
		t.Error("redirected check must fail without forwarding credentials or reporting them")
	}
}

func assertBrowserStatus(t *testing.T, err error, want int) {
	t.Helper()
	upstream, ok := errors.AsType[*Error](err)
	if !ok || upstream.Status != want {
		t.Fatalf("missing expected Vikunja status %d", want)
	}
}

func TestOverlappingBrowserDenialsShareOnlyTheirCallerTokenCheck(t *testing.T) {
	t.Parallel()
	var firstProbes, secondProbes atomic.Int32
	release := make(chan struct{})
	unblock := sync.OnceFunc(func() { close(release) })
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != probePath {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.Header.Get("Authorization") == "Bearer "+scopeFixture {
			firstProbes.Add(1)
			<-release
			w.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprint(w, `{"message":"ok"}`)
			return
		}
		secondProbes.Add(1)
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(server.Close)
	t.Cleanup(unblock)
	base := testClient(t, server.URL, "")
	first := base.ForBrowserToken(scopeFixture)
	results := make(chan error, 2)
	for range 2 {
		go func() { results <- first.DeleteTask(t.Context(), 1) }()
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		group := first.browserTokenChecks
		group.mutex.Lock()
		overlap := group.call != nil && group.call.waiters == 2
		group.mutex.Unlock()
		if overlap {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("concurrent operations did not join the same check")
		}
		time.Sleep(time.Millisecond)
	}
	other := base.ForBrowserToken("tk_distinct")
	assertBrowserStatus(t, other.DeleteTask(t.Context(), 1), http.StatusUnauthorized)
	unblock()
	for range 2 {
		assertBrowserStatus(t, <-results, http.StatusForbidden)
	}
	if firstProbes.Load() != 1 || secondProbes.Load() != 1 {
		t.Fatalf("checks per caller = %d, %d", firstProbes.Load(), secondProbes.Load())
	}
}
