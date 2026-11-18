package graphql

import (
	"context"
	"crypto/rand"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/resolver"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestSessionProfileRechecksUpstreamAndOnlyClearsRevokedCredential(t *testing.T) {
	t.Parallel()
	sessions, err := auth.NewSessionManager([]byte("test-key"), "https://vikunja.test", time.Now, rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	cookie, session, err := sessions.Issue("tk_personal", "http://app.test")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, code string
		status     int
		clear      bool
	}{
		{"revoked", "UNAUTHENTICATED", http.StatusUnauthorized, true},
		{"profile scope missing", "FORBIDDEN", http.StatusForbidden, false},
		{"temporarily unavailable", "UPSTREAM_UNAVAILABLE", http.StatusServiceUnavailable, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			root := resolver.New(resolver.Dependencies{Sessions: sessions, Users: unavailableProfile(tc.status)})
			server := auth.HTTPContext(sessions, testOrigin)(NewHandler(root, false, discardLogger()))
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				addLoginCookies(r, cookie, session)
				server.ServeHTTP(w, r)
			})
			response := graphQLRequest(t, handler, `{ session { vikunjaUser { id } } }`)
			if !strings.Contains(response.Body.String(), tc.code) {
				t.Fatalf("missing response error %s", tc.code)
			}
			cookies := response.Result().Cookies()
			if tc.clear && (len(cookies) != 1 || cookies[0].MaxAge != -1 || cookies[0].Name != "vbu_session_"+session.ID) {
				t.Error("revocation must expire the browser cookie")
			}
			if !tc.clear && len(cookies) != 0 {
				t.Error("scope/availability error must preserve the browser cookie")
			}
		})
	}
}

type unavailableProfile int

func (profile unavailableProfile) CurrentUser(context.Context) (vikunja.User, error) {
	return vikunja.User{}, &vikunja.Error{Status: int(profile)}
}
