package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/config"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestHealthHandler(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	healthHandler(recorder, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://app.test/healthz", nil))
	if recorder.Code != http.StatusOK || recorder.Body.String() != "ok\n" {
		t.Fatalf("response = %d %q", recorder.Code, recorder.Body.String())
	}
	if cacheControl := recorder.Header().Get("Cache-Control"); cacheControl != "no-store" {
		t.Fatalf("Cache-Control = %q", cacheControl)
	}
}

func TestReadinessHandlerReflectsVikunjaAvailability(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{name: "ready", wantStatus: http.StatusOK},
		{name: "unavailable", err: errors.New("offline"), wantStatus: http.StatusServiceUnavailable},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			recorder := httptest.NewRecorder()
			handler := readinessHandler(readinessStub{err: testCase.err}, slog.New(slog.DiscardHandler))
			handler.ServeHTTP(
				recorder,
				httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://app.test/readyz", nil),
			)
			if recorder.Code != testCase.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, testCase.wantStatus)
			}
			if cacheControl := recorder.Header().Get("Cache-Control"); cacheControl != "no-store" {
				t.Fatalf("Cache-Control = %q", cacheControl)
			}
		})
	}
}

func TestRegisterPublicRoutesKeepsCacheablePagesOutsideSessionMiddleware(t *testing.T) {
	t.Parallel()

	public := http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte("public"))
	})
	private := http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		http.SetCookie(writer, &http.Cookie{
			Name: "session", Value: "refreshed", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode,
		})
		_, _ = writer.Write([]byte("private"))
	})
	mux := http.NewServeMux()
	registerPublicRoutes(mux, public, private, http.NotFoundHandler(), config.Config{
		PublicActivityEnabled: true,
	})

	testCases := []struct {
		path          string
		wantBody      string
		wantSetCookie bool
	}{
		{path: "/", wantBody: "public"},
		{path: "/robots.txt", wantBody: "public"},
		{path: "/sitemap.xml", wantBody: "public"},
		{path: "/activity", wantBody: "public"},
		{path: "/all-time-activity", wantBody: "private", wantSetCookie: true},
	}
	for _, testCase := range testCases {
		t.Run(testCase.path, func(t *testing.T) {
			t.Parallel()
			recorder := httptest.NewRecorder()
			mux.ServeHTTP(recorder, httptest.NewRequestWithContext(
				t.Context(), http.MethodGet, "http://app.test"+testCase.path, nil,
			))
			if body := recorder.Body.String(); body != testCase.wantBody {
				t.Fatalf("body = %q, want %q", body, testCase.wantBody)
			}
			if got := recorder.Header().Get("Set-Cookie") != ""; got != testCase.wantSetCookie {
				t.Fatalf("Set-Cookie present = %t, want %t", got, testCase.wantSetCookie)
			}
		})
	}
}

type readinessStub struct {
	err error
}

func (stub readinessStub) CurrentUser(context.Context) (vikunja.User, error) {
	return vikunja.User{ID: 1, Username: "user"}, stub.err
}
