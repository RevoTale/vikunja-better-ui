package resolver

import (
	"context"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestPersonalLoginFailuresDoNotIssueCookies(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name, code string
		status     int
	}{
		{"revoked", "UNAUTHENTICATED", http.StatusUnauthorized},
		{"missing profile permission", "FORBIDDEN", http.StatusForbidden},
		{"outage", "UPSTREAM_UNAVAILABLE", http.StatusServiceUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			sessions, err := auth.NewSessionManager([]byte("secret"), time.Now, rand.Reader)
			if err != nil {
				t.Fatal(err)
			}
			root := New(Dependencies{
				Sessions: sessions, Limiter: auth.NewLoginLimiter(time.Now),
				LoginUser: func(context.Context, string) (vikunja.User, error) {
					return vikunja.User{}, &vikunja.Error{Status: tc.status}
				},
			})
			rec := httptest.NewRecorder()
			withRequestContext(t, sessions, rec, nil, func(ctx context.Context) {
				_, loginErr := root.Mutation().Login(ctx, model.LoginInput{Token: "tk_readable"})
				assertErrorCode(t, loginErr, tc.code)
			})
			if rec.Header().Get("Set-Cookie") != "" {
				t.Fatal("failed login issued a cookie")
			}
		})
	}
}
