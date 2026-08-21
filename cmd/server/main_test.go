package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestHealthHandler(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	healthHandler(recorder, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://app.test/healthz", nil))
	if recorder.Code != http.StatusOK || recorder.Body.String() != "ok\n" {
		t.Fatalf("response = %d %q", recorder.Code, recorder.Body.String())
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
			handler.ServeHTTP(recorder, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://app.test/readyz", nil))
			if recorder.Code != testCase.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, testCase.wantStatus)
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
