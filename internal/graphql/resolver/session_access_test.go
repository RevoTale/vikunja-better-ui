package resolver

import (
	"context"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
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
			sessions, err := auth.NewSessionManager([]byte("secret"), "https://vikunja.test", time.Now, rand.Reader)
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

func TestConcurrentLoginsReserveCapacityBeforeProfileRead(t *testing.T) {
	t.Parallel()
	const limit = 5
	entered := make(chan struct{}, limit)
	gate := make(chan struct{})
	release := sync.OnceFunc(func() { close(gate) })
	defer release()
	var calls atomic.Int32
	root := New(Dependencies{
		Limiter: auth.NewLoginLimiter(time.Now),
		LoginUser: func(context.Context, string) (vikunja.User, error) {
			if calls.Add(1) <= limit {
				entered <- struct{}{}
				<-gate
			}
			return vikunja.User{}, &vikunja.Error{Status: http.StatusServiceUnavailable}
		},
	})
	login := func() error {
		var err error
		withRequestContext(t, nil, httptest.NewRecorder(), nil, func(ctx context.Context) {
			_, err = root.Mutation().Login(ctx, model.LoginInput{Token: "tk_test"})
		})
		return err
	}
	pending := make(chan error, limit)
	for range limit {
		go func() { pending <- login() }()
	}
	deadline := time.NewTimer(2 * time.Second)
	defer deadline.Stop()
	for range limit {
		select {
		case <-entered:
		case <-deadline.C:
			t.Fatal("permitted logins did not reach Vikunja")
		}
	}
	assertErrorCode(t, login(), "UNAUTHENTICATED")
	if calls.Load() != limit {
		t.Fatal("a blocked attempt still contacted Vikunja")
	}
	release()
	for range limit {
		assertErrorCode(t, <-pending, "UPSTREAM_UNAVAILABLE")
	}
	assertErrorCode(t, login(), "UPSTREAM_UNAVAILABLE")
	if calls.Load() != limit+1 {
		t.Fatal("unavailable upstream did not release the reservations")
	}
}
