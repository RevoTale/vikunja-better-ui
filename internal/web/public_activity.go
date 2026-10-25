package web

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

const publicAllTimeWeeks = 13

type activitySnapshotReader interface {
	Read(context.Context) (service.ActivitySummary, error)
}

type allTimeSnapshotReader interface {
	Read(context.Context) (service.AllTimeActivitySummary, error)
}

type publicActivityAPI struct {
	activity   activitySnapshotReader
	allTime    allTimeSnapshotReader
	activityOn bool
	allTimeOn  bool
	now        func() time.Time
}

type publicActivityResponse struct {
	Days        []publicActivityDay      `json:"days"`
	Priorities  []publicActivityPriority `json:"priorities"`
	Total       int                      `json:"total"`
	Timezone    string                   `json:"timezone"`
	GeneratedAt time.Time                `json:"generatedAt"`
	RefreshAt   time.Time                `json:"refreshAt"`
}

type publicAllTimeActivityResponse struct {
	Weeks       []publicActivityWeek     `json:"weeks"`
	Priorities  []publicActivityPriority `json:"priorities"`
	Total       int                      `json:"total"`
	Timezone    string                   `json:"timezone"`
	GeneratedAt time.Time                `json:"generatedAt"`
	RefreshAt   time.Time                `json:"refreshAt"`
}

type publicActivityDay struct {
	Date                  string `json:"date"`
	Count                 int    `json:"count"`
	CompletedWithDeadline int    `json:"completedWithDeadline"`
	CompletedOnTime       int    `json:"completedOnTime"`
}

type publicActivityWeek = publicActivityDay

type publicActivityPriority struct {
	Priority string `json:"priority"`
	Count    int    `json:"count"`
}

// NewPublicActivityAPI serves two fixed anonymous aggregate resources.
func NewPublicActivityAPI(
	activity activitySnapshotReader,
	allTime allTimeSnapshotReader,
	activityOn bool,
	allTimeOn bool,
	now func() time.Time,
) http.Handler {
	return &publicActivityAPI{
		activity: activity, allTime: allTime, activityOn: activityOn, allTimeOn: allTimeOn, now: now,
	}
}

func (handler *publicActivityAPI) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		writer.Header().Set("Allow", "GET, HEAD")
		writePublicError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if request.URL.RawQuery != "" {
		writePublicError(writer, http.StatusBadRequest, "query parameters are not supported")
		return
	}
	if request.ContentLength != 0 {
		writePublicError(writer, http.StatusBadRequest, "request bodies are not supported")
		return
	}
	switch request.URL.Path {
	case "/public/v1/activity":
		handler.serveActivity(writer, request)
	case "/public/v1/all-time-activity":
		handler.serveAllTime(writer, request)
	default:
		writePublicError(writer, http.StatusNotFound, "not found")
	}
}

func (handler *publicActivityAPI) serveActivity(writer http.ResponseWriter, request *http.Request) {
	if !handler.activityOn || handler.activity == nil {
		writePublicError(writer, http.StatusNotFound, "not found")
		return
	}
	summary, err := handler.activity.Read(request.Context())
	if err != nil {
		writePublicError(writer, http.StatusServiceUnavailable, "activity is temporarily unavailable")
		return
	}
	response := newPublicActivityResponse(summary)
	writePublicJSON(writer, request, response, summary.GeneratedAt, summary.RefreshAt, handler.now())
}

func (handler *publicActivityAPI) serveAllTime(writer http.ResponseWriter, request *http.Request) {
	if !handler.allTimeOn || handler.allTime == nil {
		writePublicError(writer, http.StatusNotFound, "not found")
		return
	}
	summary, err := handler.allTime.Read(request.Context())
	if err != nil {
		writePublicError(writer, http.StatusServiceUnavailable, "activity is temporarily unavailable")
		return
	}
	response := newPublicAllTimeActivityResponse(summary)
	writePublicJSON(writer, request, response, summary.GeneratedAt, summary.RefreshAt, handler.now())
}

func newPublicActivityResponse(summary service.ActivitySummary) publicActivityResponse {
	return publicActivityResponse{
		Days: activityDays(summary.Days[:]), Priorities: activityPriorities(summary.Priorities),
		Total: summary.Total, Timezone: summary.Timezone,
		GeneratedAt: summary.GeneratedAt, RefreshAt: summary.RefreshAt,
	}
}

func newPublicAllTimeActivityResponse(summary service.AllTimeActivitySummary) publicAllTimeActivityResponse {
	weeks := summary.Weeks
	if len(weeks) > publicAllTimeWeeks {
		weeks = weeks[len(weeks)-publicAllTimeWeeks:]
	}
	return publicAllTimeActivityResponse{
		Weeks: activityWeeks(weeks), Priorities: activityPriorities(summary.Priorities), Total: summary.Total,
		Timezone: summary.Timezone, GeneratedAt: summary.GeneratedAt, RefreshAt: summary.RefreshAt,
	}
}

func activityDays(source []service.ActivityDay) []publicActivityDay {
	result := make([]publicActivityDay, 0, len(source))
	for _, item := range source {
		result = append(result, publicActivityDay{
			Date: item.Date, Count: item.Count, CompletedWithDeadline: item.WithDeadlineCount,
			CompletedOnTime: item.OnTimeCount,
		})
	}
	return result
}

func activityWeeks(source []service.ActivityWeek) []publicActivityWeek {
	result := make([]publicActivityWeek, 0, len(source))
	for _, item := range source {
		result = append(result, publicActivityWeek{
			Date: item.Date, Count: item.Count, CompletedWithDeadline: item.WithDeadlineCount,
			CompletedOnTime: item.OnTimeCount,
		})
	}
	return result
}

func activityPriorities(source [6]int) []publicActivityPriority {
	names := [...]string{"UNSET", "LOW", "MEDIUM", "HIGH", "URGENT", "DO_NOW"}
	result := make([]publicActivityPriority, 0, len(source))
	for index, count := range source {
		result = append(result, publicActivityPriority{Priority: names[index], Count: count})
	}
	return result
}

func writePublicJSON(
	writer http.ResponseWriter,
	request *http.Request,
	value any,
	generatedAt time.Time,
	refreshAt time.Time,
	now time.Time,
) {
	body, err := json.Marshal(value)
	if err != nil {
		writePublicError(writer, http.StatusInternalServerError, "activity is temporarily unavailable")
		return
	}
	body = append(body, '\n')
	hash := sha256.Sum256(body)
	etag := `"` + hex.EncodeToString(hash[:]) + `"`
	writer.Header().Set("Cache-Control", publicSnapshotCacheControl(now, refreshAt))
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("ETag", etag)
	writer.Header().Set("Last-Modified", generatedAt.UTC().Format(http.TimeFormat))
	writer.Header().Set("X-Robots-Tag", "noindex")
	if request.Header.Get("If-None-Match") == etag {
		writer.WriteHeader(http.StatusNotModified)
		return
	}
	writer.WriteHeader(http.StatusOK)
	if request.Method == http.MethodHead {
		return
	}
	_, _ = writer.Write(body)
}

func publicSnapshotCacheControl(now, refreshAt time.Time) string {
	seconds := min(max(int(refreshAt.Sub(now)/time.Second), 0), int(time.Hour/time.Second))
	return fmt.Sprintf("public, max-age=300, s-maxage=%d, stale-while-revalidate=60", seconds)
}

func writePublicError(writer http.ResponseWriter, status int, message string) {
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("X-Robots-Tag", "noindex")
	writer.WriteHeader(status)
	_, _ = fmt.Fprintf(writer, `{"error":{"code":"%s","message":"%s"}}`+"\n", publicErrorCode(status), message)
}

func publicErrorCode(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "BAD_REQUEST"
	case http.StatusNotFound:
		return "NOT_FOUND"
	case http.StatusMethodNotAllowed:
		return "METHOD_NOT_ALLOWED"
	case http.StatusServiceUnavailable:
		return "UPSTREAM_UNAVAILABLE"
	default:
		return "INTERNAL_ERROR"
	}
}
