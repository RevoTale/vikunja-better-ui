package web

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

type activitySnapshotStub struct {
	value service.ActivitySummary
	err   error
}

func (stub activitySnapshotStub) Read(context.Context) (service.ActivitySummary, error) {
	return stub.value, stub.err
}

type allTimeSnapshotStub struct {
	value service.AllTimeActivitySummary
	err   error
}

func (stub allTimeSnapshotStub) Read(context.Context) (service.AllTimeActivitySummary, error) {
	return stub.value, stub.err
}

func TestPublicActivityJSONUsesOneCookieIndependentCacheRepresentation(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	summary := service.ActivitySummary{
		Total: 3, Timezone: "Europe/Kyiv", GeneratedAt: now.Add(-10 * time.Minute), RefreshAt: now.Add(50 * time.Minute),
	}
	summary.Days[13] = service.ActivityDay{Date: "2026-10-25", Count: 3, WithDeadlineCount: 2, OnTimeCount: 1}
	summary.Priorities[3] = 3
	handler := NewPublicActivityAPI(
		activitySnapshotStub{value: summary}, nil, true, false, func() time.Time { return now },
	)

	first := servePublicRequest(t, handler, http.MethodGet, "/public/v1/activity", "session=private", "Bearer private")
	second := servePublicRequest(t, handler, http.MethodGet, "/public/v1/activity", "other=value", "")
	if first.Code != http.StatusOK || first.Body.String() != second.Body.String() {
		t.Fatalf("responses differ: %d %q / %d %q", first.Code, first.Body.String(), second.Code, second.Body.String())
	}
	if got := first.Header().Get("Cache-Control"); got != "public, max-age=300, s-maxage=3000, stale-while-revalidate=60" {
		t.Fatalf("Cache-Control = %q", got)
	}
	if first.Header().Get("ETag") == "" || first.Header().Get("Last-Modified") == "" ||
		first.Header().Get("Vary") != "" || first.Header().Get("Set-Cookie") != "" {
		t.Fatalf("unsafe cache headers = %#v", first.Header())
	}
	for _, forbidden := range []string{"private", "taskId", "title", "description", "project", "label"} {
		if strings.Contains(first.Body.String(), forbidden) {
			t.Fatalf("response contains %q: %s", forbidden, first.Body.String())
		}
	}
}

func TestPublicActivityJSONHonorsValidatorsAndHEAD(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	summary := service.ActivitySummary{GeneratedAt: now, RefreshAt: now.Add(time.Hour), Timezone: "UTC"}
	handler := NewPublicActivityAPI(
		activitySnapshotStub{value: summary}, nil, true, false, func() time.Time { return now },
	)

	get := servePublicRequest(t, handler, http.MethodGet, "/public/v1/activity", "", "")
	head := servePublicRequest(t, handler, http.MethodHead, "/public/v1/activity", "", "")
	if head.Code != http.StatusOK || head.Body.Len() != 0 || head.Header().Get("ETag") != get.Header().Get("ETag") {
		t.Fatalf("HEAD response = %d %#v %q", head.Code, head.Header(), head.Body.String())
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/public/v1/activity", nil)
	request.Header.Set("If-None-Match", get.Header().Get("ETag"))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotModified || recorder.Body.Len() != 0 {
		t.Fatalf("conditional response = %d %q", recorder.Code, recorder.Body.String())
	}
}

func TestPublicActivityJSONRejectsVariantsAndDisabledAccess(t *testing.T) {
	t.Parallel()
	handler := NewPublicActivityAPI(activitySnapshotStub{}, allTimeSnapshotStub{}, false, false, time.Now)
	for _, testCase := range []struct {
		method string
		path   string
		status int
	}{
		{method: http.MethodGet, path: "/public/v1/activity", status: http.StatusNotFound},
		{method: http.MethodGet, path: "/public/v1/all-time-activity", status: http.StatusNotFound},
		{method: http.MethodGet, path: "/public/v1/activity?priority=high", status: http.StatusBadRequest},
		{method: http.MethodPost, path: "/public/v1/activity", status: http.StatusMethodNotAllowed},
	} {
		recorder := servePublicRequest(t, handler, testCase.method, testCase.path, "", "")
		if recorder.Code != testCase.status || recorder.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("%s %s = %d %#v", testCase.method, testCase.path, recorder.Code, recorder.Header())
		}
	}
	bodyRequest := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet, "/public/v1/activity", strings.NewReader("x"),
	)
	bodyRecorder := httptest.NewRecorder()
	handler.ServeHTTP(bodyRecorder, bodyRequest)
	if bodyRecorder.Code != http.StatusBadRequest ||
		!strings.Contains(bodyRecorder.Body.String(), `"code":"BAD_REQUEST"`) {
		t.Fatalf("body response = %d %q", bodyRecorder.Code, bodyRecorder.Body.String())
	}
	chunkedRequest := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet, "/public/v1/activity", strings.NewReader("x"),
	)
	chunkedRequest.ContentLength = -1
	chunkedRequest.TransferEncoding = []string{"chunked"}
	chunkedRecorder := httptest.NewRecorder()
	handler.ServeHTTP(chunkedRecorder, chunkedRequest)
	if chunkedRecorder.Code != http.StatusBadRequest {
		t.Fatalf("chunked body response = %d %q", chunkedRecorder.Code, chunkedRecorder.Body.String())
	}
}

func TestPublicAllTimeJSONIsBoundedToLatestThirteenWeeks(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	weeks := make([]service.ActivityWeek, 20)
	for index := range weeks {
		weeks[index].Date = now.AddDate(0, 0, (index-19)*7).Format(time.DateOnly)
		weeks[index].Count = index + 1
	}
	summary := service.AllTimeActivitySummary{
		Weeks: weeks, Total: 210, Timezone: "UTC", GeneratedAt: now, RefreshAt: now.Add(time.Hour),
	}
	handler := NewPublicActivityAPI(nil, allTimeSnapshotStub{value: summary}, false, true, func() time.Time { return now })
	recorder := servePublicRequest(t, handler, http.MethodGet, "/public/v1/all-time-activity", "", "")
	if recorder.Code != http.StatusOK || strings.Count(recorder.Body.String(), `"date"`) != 13 ||
		strings.Contains(recorder.Body.String(), weeks[6].Date) || !strings.Contains(recorder.Body.String(), weeks[7].Date) {
		t.Fatalf("bounded response = %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestPublicActivityJSONDoesNotCacheFailures(t *testing.T) {
	t.Parallel()
	handler := NewPublicActivityAPI(activitySnapshotStub{err: errors.New("upstream secret")}, nil, true, false, time.Now)
	recorder := servePublicRequest(t, handler, http.MethodGet, "/public/v1/activity", "", "")
	if recorder.Code != http.StatusServiceUnavailable || recorder.Header().Get("Cache-Control") != "no-store" ||
		strings.Contains(recorder.Body.String(), "secret") {
		t.Fatalf("failure response = %d %#v %q", recorder.Code, recorder.Header(), recorder.Body.String())
	}
}

func servePublicRequest(
	t *testing.T, handler http.Handler, method, target, cookie, authorization string,
) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), method, target, nil)
	if cookie != "" {
		request.Header.Set("Cookie", cookie)
	}
	if authorization != "" {
		request.Header.Set("Authorization", authorization)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}
