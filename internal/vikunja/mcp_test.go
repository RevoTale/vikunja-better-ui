package vikunja

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestMCPAccessRequiresNativeAcknowledgement(t *testing.T) {
	t.Parallel()
	for _, status := range []int{http.StatusAccepted, http.StatusOK, http.StatusUnauthorized, http.StatusForbidden} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost || r.URL.Path != "/api/v2/mcp" ||
					r.Header.Get("Authorization") != "Bearer tk_fixture" ||
					r.Header.Get("Accept") != "application/json, text/event-stream" {
					t.Errorf("unexpected MCP validation request")
				}
				w.WriteHeader(status)
			}))
			defer server.Close()
			base, err := url.Parse(server.URL)
			if err != nil {
				t.Fatal(err)
			}
			client := NewClient(base, "tk_fixture")
			defer client.CloseIdleConnections()
			err = client.CheckMCPAccess(t.Context())
			if status == http.StatusAccepted {
				if err != nil {
					t.Fatal(err)
				}
				return
			}
			var upstream *Error
			if !errors.As(err, &upstream) || upstream.Status != status {
				t.Fatalf("status %d accepted or obscured: %v", status, err)
			}
		})
	}
}
