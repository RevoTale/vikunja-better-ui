package auth

import (
	"crypto/rand"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func TestDelayedSessionResponsesCannotOverrideNewLoginOrLogout(t *testing.T) {
	t.Parallel()
	now := time.Now()
	manager, err := NewSessionManager([]byte("deployment-key"), testUpstream, func() time.Time { return now }, rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	target := &url.URL{Scheme: "http", Host: "app.test", Path: "/graphql"}
	start := func(value string) string {
		encoded, session, issueErr := manager.Issue(value, target.Scheme+"://"+target.Host)
		if issueErr != nil {
			t.Fatal(issueErr)
		}
		_, response := browserCall(t, manager, jar.Cookies(target), func(info *RequestInfo) {
			info.ClearSession()
			info.Cookies.Start(info.Writer, encoded, session)
		})
		jar.SetCookies(target, response)
		return session.ID
	}
	first := start("tk_first")
	now = now.Add(16 * 24 * time.Hour)
	previous := jar.Cookies(target)
	_, renew := browserCall(t, manager, previous, nil)
	_, revoke := browserCall(t, manager, previous, (*RequestInfo).ClearSession)
	if len(renew) != 1 || renew[0].Name != localSessionCookie+"_"+first || renew[0].MaxAge < 0 {
		t.Fatal("renewal must replace only the previous credential")
	}
	if len(revoke) == 0 || revoke[len(revoke)-1].MaxAge != -1 {
		t.Fatal("revocation must expire the previous credential")
	}
	second := start("tk_second")
	jar.SetCookies(target, renew)
	jar.SetCookies(target, revoke)
	if got, _ := browserCall(t, manager, jar.Cookies(target), nil); got != second {
		t.Fatal("an old response replaced the active login")
	}
	got, logout := browserCall(t, manager, jar.Cookies(target), (*RequestInfo).Logout)
	if got != second {
		t.Fatal("logout received the wrong session")
	}
	jar.SetCookies(target, logout)
	jar.SetCookies(target, renew)
	if got, _ := browserCall(t, manager, jar.Cookies(target), nil); got != "" {
		t.Fatal("delayed renewal resurrected a signed-out user")
	}
}

func TestSelectorMustMatchTheEncryptedSessionIdentity(t *testing.T) {
	t.Parallel()
	manager := replica(t, "test-key", testUpstream)
	firstToken, _, err := manager.Issue("tk_first", "http://app.test")
	if err != nil {
		t.Fatal(err)
	}
	_, second, err := manager.Issue("tk_second", "http://app.test")
	if err != nil {
		t.Fatal(err)
	}
	// Even a valid ciphertext cannot be moved under another login's cookie name.
	rec := httptest.NewRecorder()
	NewSessionCookies(false).Start(rec, firstToken, second)
	got, cleared := browserCall(t, manager, rec.Result().Cookies(), nil)
	if got != "" || len(cleared) != 1 || cleared[0].MaxAge != -1 ||
		cleared[0].Name != localSessionCookie+"_"+second.ID {
		t.Fatal("mixed selector and credential did not fail closed")
	}
}

func browserCall(
	t *testing.T, manager *SessionManager, cookies []*http.Cookie, action func(*RequestInfo),
) (string, []*http.Cookie) {
	t.Helper()
	var identity string
	handler := HTTPContext(manager, testOrigin)(http.HandlerFunc(func(_ http.ResponseWriter, req *http.Request) {
		if session, ok := SessionFromContext(req.Context()); ok {
			identity = session.ID
		}
		if action != nil {
			info, _ := RequestInfoFromContext(req.Context())
			action(info)
		}
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "http://app.test/graphql", nil)
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}
	handler.ServeHTTP(rec, req)
	return identity, rec.Result().Cookies()
}
