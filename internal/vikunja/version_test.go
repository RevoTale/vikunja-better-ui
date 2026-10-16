package vikunja

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequireSupportedVersion(t *testing.T) {
	t.Parallel()
	for _, version := range []string{"2.6.9", "2.7.0-rc.1", "unknown", "2.7.0", "v2.7.1", "2.8.0", "3.0.0"} {
		t.Run(version, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/api/v2/info" {
					t.Errorf("unexpected version request: %s", r.URL.Path)
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"version":"` + version + `"}`))
			}))
			t.Cleanup(server.Close)
			err := testClient(t, server.URL, "token").RequireSupportedVersion(t.Context())
			wantError := version == "2.6.9" || version == "2.7.0-rc.1" || version == "unknown"
			if (err != nil) != wantError {
				t.Fatalf("version %s: %v", version, err)
			}
		})
	}
}
