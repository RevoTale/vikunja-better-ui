package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestDiscussionSeedPreservesReplyChainAndStopsOnFailure(t *testing.T) {
	t.Parallel()
	for _, failAt := range []int64{-1, 2} {
		t.Run(strconv.FormatInt(failAt, 10), func(t *testing.T) {
			t.Parallel()
			var calls atomic.Int64
			server := discussionSeedServer(t, &calls, failAt)
			api := &fixtureAPI{baseURL: server.URL, token: "fixture-token"}
			source, err := api.seedReplyChain(t.Context(), 42)
			if failAt < 0 {
				if err != nil || source != 100 || calls.Load() != 51 {
					t.Fatalf("source=%d calls=%d err=%v", source, calls.Load(), err)
				}
			} else if err == nil || source != 0 || calls.Load() != failAt+1 || strings.Contains(err.Error(), "private") {
				t.Fatalf("did not stop safely: source=%d calls=%d err=%v", source, calls.Load(), err)
			}
		})
	}
}

func discussionSeedServer(t *testing.T, calls *atomic.Int64, failAt int64) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		index := calls.Add(1) - 1
		if r.Method != http.MethodPost || r.URL.Path != "/api/v2/tasks/42/comments" ||
			r.Header.Get("Authorization") != "Bearer fixture-token" {
			t.Error("unexpected fixture request")
		}
		if index == failAt {
			http.Error(w, "private upstream error", http.StatusInternalServerError)
			return
		}
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if index == 1 && !strings.Contains(body["comment"], "data-comment-id=\"100\"") {
			t.Error("missing original reference")
		}
		if index == 50 && !strings.Contains(body["comment"], "data-comment-id=\"101\"") {
			t.Error("missing parent reference")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"id": 100 + index, "created": time.Unix(1000+index, 0).UTC()})
	}))
	t.Cleanup(server.Close)
	return server
}

func discussionDirectory(t *testing.T, origin string) string {
	t.Helper()
	//nolint:usetesting // The ownership boundary requires a direct child of the system temporary directory.
	directory, err := os.MkdirTemp("", "vikunja-better-ui-e2e.")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(directory) })
	if err = os.WriteFile(filepath.Join(directory, ".discussion-fixture"), []byte(origin), 0o600); err != nil {
		t.Fatal(err)
	}
	return directory
}

func TestDiscussionFixtureRejectsForeignOriginsAndOwnership(t *testing.T) {
	t.Parallel()
	for _, scenario := range []struct {
		origin         string
		service, valid bool
	}{
		{"http://127.0.0.1:3456", false, true}, {"http://vikunja:3456", true, true},
		{"http://vikunja:3456", false, false}, {"http://vikunja:9999", true, false},
		{"https://127.0.0.1:3456", false, false}, {"http://other:3456", true, false},
		{"http://user:password@127.0.0.1:3456", false, false}, {"http://127.0.0.1:3456/other", false, false},
		{"http://127.0.0.1:3456?other=1", false, false}, {"http://127.0.0.1:3456#other", false, false},
	} {
		t.Run(fmt.Sprintf("%s-%t", scenario.origin, scenario.service), func(t *testing.T) {
			t.Parallel()
			directory := discussionDirectory(t, scenario.origin)
			err := validateDiscussionFixture(directory, scenario.origin, scenario.service)
			if (err == nil) != scenario.valid {
				t.Fatalf("validation=%v", err)
			}
			if err = validateDiscussionFixture(t.TempDir(), scenario.origin, scenario.service); err == nil {
				t.Fatal("accepted foreign directory")
			}
			if err = os.WriteFile(filepath.Join(directory, ".discussion-fixture"), []byte("foreign"), 0o600); err != nil {
				t.Fatal(err)
			}
			if err = validateDiscussionFixture(directory, scenario.origin, scenario.service); err == nil {
				t.Fatal("accepted foreign ownership")
			}
		})
	}
}

func TestDiscussionSeedRejectsInvalidTaskIDs(t *testing.T) {
	t.Parallel()
	for _, id := range []string{"0", "-1", "42 OR 1=1", "999999999999999999999"} {
		if err := seedDiscussion(context.Background(), id); err == nil {
			t.Fatal("accepted invalid task ID")
		}
	}
}
