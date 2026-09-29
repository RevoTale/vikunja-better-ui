package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestJobsHandlerMapsVikunjaAuthorizationErrors(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name           string
		upstreamStatus int
		wantStatus     int
		wantCode       string
	}{
		{
			name:           "invalid token",
			upstreamStatus: http.StatusUnauthorized,
			wantStatus:     http.StatusUnauthorized,
			wantCode:       "UNAUTHENTICATED",
		},
		{
			name:           "insufficient permissions",
			upstreamStatus: http.StatusForbidden,
			wantStatus:     http.StatusForbidden,
			wantCode:       "FORBIDDEN",
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.WriteHeader(testCase.upstreamStatus)
			}))
			defer upstream.Close()
			handler := newTestJobsHandler(t, upstream.URL, time.Now)
			request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/integrations/v1/jobs", nil)
			request.Header.Set("Authorization", "Bearer tk_not_in_response")
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			if recorder.Code != testCase.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, testCase.wantStatus)
			}
			body := recorder.Body.String()
			var response errorResponse
			if err := json.Unmarshal([]byte(body), &response); err != nil {
				t.Fatal(err)
			}
			if response.Error.Code != testCase.wantCode {
				t.Fatalf("error = %#v", response.Error)
			}
			if strings.Contains(body, "tk_not_in_response") {
				t.Fatal("response exposed the Vikunja token")
			}
		})
	}
}

func TestJobsHandlerReturnsEmptyPageForUnknownLabel(t *testing.T) {
	t.Parallel()

	var requestCount atomic.Int64
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestCount.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v2/user":
			writeTestJSON(t, writer, map[string]any{
				"id": 1, "username": "dashboard",
				"settings": map[string]any{"timezone": "UTC", "week_start": 1},
			})
		case "/api/v2/projects":
			writeTestPage(t, writer, []map[string]any{{"id": 7, "title": "Home"}})
		case "/api/v2/labels":
			writeTestPage(t, writer, []map[string]any{{"id": 4, "title": "vbu:job"}})
		default:
			t.Errorf("unexpected upstream path %q", request.URL.Path)
			http.NotFound(writer, request)
		}
	}))
	defer upstream.Close()
	handler := newTestJobsHandler(t, upstream.URL, time.Now)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/integrations/v1/jobs?label=missing", nil)
	request.Header.Set("Authorization", "Bearer tk_glance")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; body = %q", recorder.Code, recorder.Body.String())
	}
	var response jobsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if len(response.Items) != 0 || response.TotalItems != 0 || !response.IsComplete {
		t.Fatalf("response = %#v", response)
	}
	if got := requestCount.Load(); got != 3 {
		t.Fatalf("upstream requests = %d, want 3", got)
	}
}
