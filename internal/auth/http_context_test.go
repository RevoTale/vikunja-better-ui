package auth

import (
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHTTPContextProvidesValidSessionAndRequestData(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	manager, err := NewSessionManager(
		[]byte("01234567890123456789012345678901"), func() time.Time { return now }, rand.Reader,
	)
	if err != nil {
		t.Fatal(err)
	}
	token, wantSession, err := manager.Issue("tk_test", "http://app.test")
	if err != nil {
		t.Fatal(err)
	}

	handler := HTTPContext(manager, testOrigin)(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		session, ok := SessionFromContext(request.Context())
		if !ok || session.ID != wantSession.ID {
			t.Errorf("SessionFromContext() = %#v, %v", session, ok)
		}
		info, ok := RequestInfoFromContext(request.Context())
		if !ok || info.Writer != writer || info.Request != request || info.ClientIP != "192.0.2.8" {
			t.Errorf("RequestInfoFromContext() = %#v, %v", info, ok)
		}
		writer.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "http://app.test/graphql", nil)
	request.RemoteAddr = "192.0.2.8:1234"
	cookies := httptest.NewRecorder()
	NewSessionCookies(false).Start(cookies, token, wantSession)
	for _, cookie := range cookies.Result().Cookies() {
		request.AddCookie(cookie)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d", recorder.Code)
	}
}

func TestHTTPContextClearsInvalidSession(t *testing.T) {
	t.Parallel()

	manager, err := NewSessionManager([]byte("01234567890123456789012345678901"), time.Now, rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	handler := HTTPContext(manager, testOrigin)(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		if _, ok := SessionFromContext(request.Context()); ok {
			t.Error("invalid session was added to context")
		}
	}))

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://app.test/graphql", nil)
	const selector = "MDEyMzQ1Njc4OWFiY2RlZg"
	request.Header.Set("Cookie", localSessionCookie+"="+selector+"; "+localSessionCookie+"_"+selector+"=invalid")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if len(recorder.Result().Cookies()) != 1 || recorder.Result().Cookies()[0].MaxAge != -1 {
		t.Fatalf("cookies = %#v", recorder.Result().Cookies())
	}
}

func testOrigin(*http.Request) string { return "http://app.test" }
