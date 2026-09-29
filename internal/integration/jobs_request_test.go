package integration

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type invalidJobsRequest struct {
	name          string
	method        string
	target        string
	authorization string
	wantStatus    int
}

func TestJobsHandlerRejectsAuthentication(t *testing.T) {
	t.Parallel()
	assertInvalidJobsRequests(t, []invalidJobsRequest{
		{
			name:          "post",
			method:        http.MethodPost,
			target:        "/integrations/v1/jobs",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusMethodNotAllowed,
		},
		{name: "missing token", method: http.MethodGet, target: "/integrations/v1/jobs", wantStatus: http.StatusUnauthorized},
		{
			name:          "wrong scheme",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs",
			authorization: "Basic abc",
			wantStatus:    http.StatusUnauthorized,
		},
		{
			name:          "empty bearer",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs",
			authorization: "Bearer ",
			wantStatus:    http.StatusUnauthorized,
		},
	})
}

func TestJobsHandlerRejectsPaginationAndLabels(t *testing.T) {
	t.Parallel()
	assertInvalidJobsRequests(t, []invalidJobsRequest{
		{
			name:          "invalid page",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?page=0",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "oversized page",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?pageSize=101",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "empty label",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?label=",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "malformed query",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?page=1;pageSize=2",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "unknown parameter",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?scope=week",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
	})
}

func TestJobsHandlerRejectsStatus(t *testing.T) {
	t.Parallel()
	assertInvalidJobsRequests(t, []invalidJobsRequest{
		{
			name:          "invalid status",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?status=done",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "duplicate status",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?status=active&status=completed",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "active completion boundary",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?completedFrom=2026-08-24T00%3A00%3A00Z",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
	})
}

func TestJobsHandlerRejectsCompletionRange(t *testing.T) {
	t.Parallel()
	assertInvalidJobsRequests(t, []invalidJobsRequest{
		{
			name:          "completed without boundaries",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?status=completed",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "completed without upper boundary",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?status=completed&completedFrom=2026-08-24T00%3A00%3A00Z",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:   "malformed completion boundary",
			method: http.MethodGet,
			target: "/integrations/v1/jobs?status=completed&completedFrom=yesterday" +
				"&completedBefore=2026-08-31T00%3A00%3A00Z",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:   "equal completion boundaries",
			method: http.MethodGet,
			target: "/integrations/v1/jobs?status=completed&completedFrom=2026-08-24T00%3A00%3A00Z" +
				"&completedBefore=2026-08-24T00%3A00%3A00Z",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:   "reversed completion boundaries",
			method: http.MethodGet,
			target: "/integrations/v1/jobs?status=completed&completedFrom=2026-08-31T00%3A00%3A00Z" +
				"&completedBefore=2026-08-24T00%3A00%3A00Z",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
	})
}

func TestJobsHandlerRejectsSorting(t *testing.T) {
	t.Parallel()
	assertInvalidJobsRequests(t, []invalidJobsRequest{
		{
			name:          "all without boundaries",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?status=all",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:   "all invalid sort",
			method: http.MethodGet,
			target: "/integrations/v1/jobs?status=all&completedFrom=2026-08-24T00%3A00%3A00Z" +
				"&completedBefore=2026-08-31T00%3A00%3A00Z&sortBy=dueAt",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:   "all invalid order",
			method: http.MethodGet,
			target: "/integrations/v1/jobs?status=all&completedFrom=2026-08-24T00%3A00%3A00Z" +
				"&completedBefore=2026-08-31T00%3A00%3A00Z&sortOrder=newest",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "active sort",
			method:        http.MethodGet,
			target:        "/integrations/v1/jobs?sortBy=startAt",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:   "completed sort",
			method: http.MethodGet,
			target: "/integrations/v1/jobs?status=completed&completedFrom=2026-08-24T00%3A00%3A00Z" +
				"&completedBefore=2026-08-31T00%3A00%3A00Z&sortOrder=asc",
			authorization: "Bearer tk_valid",
			wantStatus:    http.StatusBadRequest,
		},
	})
}

func assertInvalidJobsRequests(t *testing.T, testCases []invalidJobsRequest) {
	t.Helper()
	handler := newTestJobsHandler(
		t,
		"https://vikunja.example.test",
		func() time.Time { return time.Date(2026, time.August, 16, 12, 0, 0, 0, time.UTC) },
	)
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			request := httptest.NewRequestWithContext(t.Context(), testCase.method, testCase.target, nil)
			request.Header.Set("Authorization", testCase.authorization)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			if recorder.Code != testCase.wantStatus {
				t.Fatalf("status = %d, want %d; body = %q", recorder.Code, testCase.wantStatus, recorder.Body.String())
			}
			if recorder.Header().Get("Content-Type") != "application/json; charset=utf-8" {
				t.Fatalf("content type = %q", recorder.Header().Get("Content-Type"))
			}
		})
	}
}
