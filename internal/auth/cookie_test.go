package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSessionCookiePolicy(t *testing.T) {
	t.Parallel()

	expiresAt := time.Date(2026, time.September, 11, 9, 30, 0, 0, time.UTC)
	tests := []struct {
		name       string
		production bool
		wantName   string
		wantSecure bool
	}{
		{name: "production", production: true, wantName: "__Host-vbu_session", wantSecure: true},
		{name: "local", production: false, wantName: "vbu_session", wantSecure: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			recorder := httptest.NewRecorder()
			cookies := NewSessionCookies(test.production)
			cookies.Set(recorder, "signed-token", expiresAt)
			response := recorder.Result()
			t.Cleanup(func() { _ = response.Body.Close() })
			setCookies := response.Cookies()
			if len(setCookies) != 1 {
				t.Fatalf("len(Cookies()) = %d, want 1", len(setCookies))
			}

			cookie := setCookies[0]
			if cookie.Name != test.wantName || cookie.Value != "signed-token" {
				t.Fatalf("cookie name/value = %q/%q", cookie.Name, cookie.Value)
			}
			if !cookie.HttpOnly || cookie.Secure != test.wantSecure {
				t.Fatalf("cookie HttpOnly/Secure = %v/%v", cookie.HttpOnly, cookie.Secure)
			}
			if cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/" || cookie.Domain != "" {
				t.Fatalf("cookie policy = %#v", cookie)
			}
			if !cookie.Expires.Equal(expiresAt) {
				t.Fatalf("cookie expiry = %v, want %v", cookie.Expires, expiresAt)
			}
		})
	}
}

func TestSessionCookieClear(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	cookies := NewSessionCookies(true)
	cookies.Clear(recorder)
	response := recorder.Result()
	t.Cleanup(func() { _ = response.Body.Close() })
	setCookies := response.Cookies()
	if len(setCookies) != 1 {
		t.Fatalf("len(Cookies()) = %d, want 1", len(setCookies))
	}
	if cookie := setCookies[0]; cookie.MaxAge != -1 || cookie.Value != "" {
		t.Fatalf("cleared cookie = %#v", cookie)
	}
}

func TestSessionCookieRead(t *testing.T) {
	t.Parallel()

	cookies := NewSessionCookies(false)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "http://tasks.test/graphql", nil)
	request.AddCookie(&http.Cookie{
		Name: "vbu_session", Value: "signed-token", Secure: true,
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})

	value, err := cookies.Read(request)
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	if value != "signed-token" {
		t.Fatalf("Read() = %q, want signed token", value)
	}
}
