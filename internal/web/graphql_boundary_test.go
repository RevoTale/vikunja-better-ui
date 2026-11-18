package web

import (
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
)

func TestGraphQLBoundaryAcceptsExactOriginJSONPost(t *testing.T) {
	t.Parallel()

	origin, err := url.Parse("https://tasks.example.test")
	if err != nil {
		t.Fatal(err)
	}
	handler := GraphQLBoundary(origin, nil)(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequestWithContext(
		t.Context(),
		http.MethodPost,
		"https://tasks.example.test/graphql",
		strings.NewReader(`{"query":"{ session { authenticated } }"}`),
	)
	request.Header.Set("Origin", origin.String())
	request.Header.Set("Content-Type", "application/json; charset=utf-8")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d", recorder.Code)
	}
	if cacheControl := recorder.Header().Get("Cache-Control"); cacheControl != "private, no-store" {
		t.Fatalf("Cache-Control = %q", cacheControl)
	}
}

func TestGraphQLBoundaryAuthenticatesMultipartBeforeReadingBody(t *testing.T) {
	t.Parallel()
	origin, _ := url.Parse("https://tasks.example.test")
	sessions, err := auth.NewSessionManager([]byte("test-secret"), time.Now, rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	token, session, err := sessions.Issue("tk_test", origin.String())
	if err != nil {
		t.Fatal(err)
	}
	cookies := auth.NewSessionCookies(true)
	w := httptest.NewRecorder()
	cookies.Start(w, token, session)
	pair := w.Result().Cookies()
	for _, test := range []struct {
		name, csrf string
		signed     bool
		size       int64
		status     int
	}{
		{"anonymous", "", false, 5, http.StatusUnauthorized},
		{"no csrf", "", true, 5, http.StatusForbidden},
		{"bad csrf", "wrong", true, 5, http.StatusForbidden},
		{"unknown length", sessions.CSRFToken(session), true, -1, http.StatusLengthRequired},
		{"valid", sessions.CSRFToken(session), true, 5, http.StatusNoContent},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			})
			handler := GraphQLBoundary(origin, sessions)(next)
			r := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/graphql", strings.NewReader("bytes"))
			r.ContentLength = test.size
			r.Header.Set("Content-Type", "multipart/form-data; boundary=test")
			r.Header.Set("Origin", origin.String())
			r.Header.Set("X-Csrf-Token", test.csrf)
			if test.signed {
				addSessionCookies(r, pair)
			}
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != test.status {
				t.Fatalf("status = %d, want %d", w.Code, test.status)
			}
		})
	}
}

func TestGraphQLBoundaryRejectsUnsafeRequests(t *testing.T) {
	t.Parallel()

	origin, err := url.Parse("https://tasks.example.test")
	if err != nil {
		t.Fatal(err)
	}
	handler := GraphQLBoundary(origin, nil)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("protected handler was called")
	}))
	testCases := []struct {
		name        string
		method      string
		origin      string
		contentType string
		bodySize    int
		wantStatus  int
	}{
		{
			name: "get", method: http.MethodGet, origin: origin.String(), contentType: "application/json",
			wantStatus: http.StatusMethodNotAllowed,
		},
		{name: "missing origin", method: http.MethodPost, contentType: "application/json", wantStatus: http.StatusForbidden},
		{
			name: "cross origin", method: http.MethodPost, origin: "https://evil.example",
			contentType: "application/json",
			wantStatus:  http.StatusForbidden,
		},
		{
			name:        "form content",
			method:      http.MethodPost,
			origin:      origin.String(),
			contentType: "text/plain",
			wantStatus:  http.StatusUnsupportedMediaType,
		},
		{
			name:        "oversized",
			method:      http.MethodPost,
			origin:      origin.String(),
			contentType: "application/json",
			bodySize:    int(maxGraphQLBodyBytes + 1),
			wantStatus:  http.StatusRequestEntityTooLarge,
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			body := strings.NewReader(strings.Repeat("x", testCase.bodySize))
			request := httptest.NewRequestWithContext(t.Context(), testCase.method, "https://tasks.example.test/graphql", body)
			request.Header.Set("Origin", testCase.origin)
			request.Header.Set("Content-Type", testCase.contentType)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			if recorder.Code != testCase.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, testCase.wantStatus)
			}
		})
	}
}

func TestRejectedGraphQLOriginLeavesSessionCookiesUntouched(t *testing.T) {
	t.Parallel()
	const target = "https://tasks.example.test"
	origin, err := url.Parse(target)
	if err != nil {
		t.Fatal(err)
	}
	manager, err := auth.NewSessionManager([]byte("test-key"), time.Now, rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	_, session, err := manager.Issue("tk_fixture", target)
	if err != nil {
		t.Fatal(err)
	}
	cookies := httptest.NewRecorder()
	auth.NewSessionCookies(true).Start(cookies, "invalid-ciphertext", session)
	handler := GraphQLBoundary(origin, manager)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("rejected request reached GraphQL")
	}))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, target+"/graphql", nil)
	for _, cookie := range cookies.Result().Cookies() {
		request.AddCookie(cookie)
	}
	request.Header.Set("Origin", "https://other.example.test")
	writer := httptest.NewRecorder()
	handler.ServeHTTP(writer, request)
	if writer.Code != http.StatusForbidden || len(writer.Header().Values("Set-Cookie")) != 0 {
		t.Fatal("rejection must precede session refresh or cleanup")
	}
}
