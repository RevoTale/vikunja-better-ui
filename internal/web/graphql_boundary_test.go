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
	sessions := auth.NewSessionManager([]byte("test-secret"), time.Now, rand.Reader)
	token, session, err := sessions.Issue()
	if err != nil {
		t.Fatal(err)
	}
	cookies := auth.NewSessionCookies(false)
	w := httptest.NewRecorder()
	cookies.Set(w, token, session.ExpiresAt)
	cookie := w.Result().Cookies()[0]
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
			handler := auth.HTTPContext(sessions, cookies)(GraphQLBoundary(origin, sessions)(next))
			r := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/graphql", strings.NewReader("bytes"))
			r.ContentLength = test.size
			r.Header.Set("Content-Type", "multipart/form-data; boundary=test")
			r.Header.Set("Origin", origin.String())
			r.Header.Set("X-Csrf-Token", test.csrf)
			if test.signed {
				r.AddCookie(cookie)
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
