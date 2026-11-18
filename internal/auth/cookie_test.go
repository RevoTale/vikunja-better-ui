package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSessionCookiePolicy(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.September, 11, 9, 30, 0, 0, time.UTC)
	session := Session{ID: "MDEyMzQ1Njc4OWFiY2RlZg", IssuedAt: now, ExpiresAt: now.Add(sessionLifetime)}
	for _, tc := range []struct {
		name   string
		secure bool
	}{
		{"__Host-vbu_session", true},
		{"vbu_session", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			policy := NewSessionCookies(tc.secure)
			rec := httptest.NewRecorder()
			policy.Start(rec, "encrypted-token", session)
			cookies := rec.Result().Cookies()
			if len(cookies) != 2 {
				t.Fatalf("login wrote %d cookies", len(cookies))
			}
			request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/graphql", nil)
			for _, cookie := range cookies {
				if !cookie.HttpOnly || cookie.Secure != tc.secure || cookie.SameSite != http.SameSiteLaxMode ||
					cookie.Path != "/" || cookie.Domain != "" {
					t.Fatalf("incorrect attributes on %s", cookie.Name)
				}
				request.AddCookie(cookie)
			}
			if policy.selected(request) != session.ID || cookies[0].Name != tc.name ||
				!cookies[0].Expires.Equal(now.Add(selectorLifetime)) {
				t.Fatal("missing or short-lived session selector")
			}
			if cookies[1].Name != tc.name+"_"+session.ID || cookies[1].Value != "encrypted-token" ||
				!cookies[1].Expires.Equal(session.ExpiresAt) {
				t.Fatal("incorrect credential cookie")
			}
		})
	}
}

func TestSessionCookieRejectsInvalidSelectors(t *testing.T) {
	t.Parallel()
	policy := NewSessionCookies(false)
	for _, value := range []string{"legacy.payload", "MDEyMzQ1Njc4OWFiY2RlZ!", "", "MDEyMzQ1Njc4OWFiY2RlZh"} {
		request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
		request.Header.Set("Cookie", localSessionCookie+"="+value)
		if got := policy.selected(request); got != "" {
			t.Fatal("invalid selector accepted")
		}
	}
}
