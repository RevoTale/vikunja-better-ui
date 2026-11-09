package vikunja

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCallerClientsShareTransportButNotCredentialsOrMetadata(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		name := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		_ = json.NewEncoder(w).Encode(User{ID: 1, Username: name})
	}))
	t.Cleanup(server.Close)
	base := testClient(t, server.URL, "")
	t.Cleanup(base.CloseIdleConnections)
	for _, token := range []string{"tk_first", "tk_second"} {
		t.Run(token, func(t *testing.T) {
			t.Parallel()
			client := base.ForToken(token)
			if client.httpClient != base.httpClient || client == base {
				t.Fatal("incorrect transport lifetime")
			}
			user, err := client.CurrentUser(t.Context())
			if err != nil || user.Username != token {
				t.Fatalf("caller mix-up: %v", err)
			}
		})
	}
}
