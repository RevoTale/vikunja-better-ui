package main

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

func fixtureTime(t *testing.T, value string) time.Time {
	t.Helper()
	location, err := time.LoadLocation(fixtureTimezone)
	if err != nil {
		t.Fatal(err)
	}
	now, err := time.Parse(time.RFC3339, value)
	if err != nil {
		t.Fatal(err)
	}
	return now.In(location)
}

func TestPreviewHistoryVariesAcrossThreeWeeks(t *testing.T) {
	t.Parallel()
	now := fixtureTime(t, "2026-10-15T12:00:00Z")
	tasks := previewActivityTasks(now, 42)
	dates, priorities := map[string]bool{}, map[int]bool{}
	var noDeadline, early, late bool
	for _, task := range tasks {
		dates[task.DoneAt.Format(time.DateOnly)], priorities[task.Priority] = true, true
		if task.DoneAt.After(now) {
			t.Fatal("future completion")
		}
		switch {
		case task.DueDate.IsZero():
			noDeadline = true
		case task.DoneAt.Before(task.DueDate):
			early = true
		default:
			late = true
		}
	}
	if len(dates) != 21 || !dates["2026-09-25"] || len(priorities) != 6 || !noDeadline || !early || !late {
		t.Fatal("preview lost date, priority or timeliness coverage")
	}
	same, different := previewActivityTasks(now, 42), previewActivityTasks(now, 43)
	if !reflect.DeepEqual(tasks, same) || reflect.DeepEqual(tasks, different) {
		t.Fatal("seed reproducibility failed")
	}
}

func TestSchedulesPreserveCoverageAndLocalClockAcrossDST(t *testing.T) {
	t.Parallel()
	definitions, err := readSchedules()
	if err != nil {
		t.Fatal(err)
	}
	if len(definitions.Schedule) != 11 || len(definitions.Week) != 8 {
		t.Fatal("missing fixture scenarios")
	}
	now := fixtureTime(t, "2026-10-26T12:00:00Z")
	date := dateSpec{Kind: "at", Hour: 7, Minute: 30, DayOffset: -2}.at(now)
	if date.Format(time.RFC3339) != "2026-10-24T04:30:00Z" {
		t.Fatalf("before DST = %s", date)
	}
	date = dateSpec{Kind: "at", Hour: 7, Minute: 30, DayOffset: -1}.at(now)
	if date.Format(time.RFC3339) != "2026-10-25T05:30:00Z" {
		t.Fatalf("after DST = %s", date)
	}
	week := dateSpec{Kind: "week", Weekday: 6, Hour: 19}.at(now)
	if week.In(now.Location()).Format(time.RFC3339) != "2026-11-01T19:00:00+02:00" {
		t.Fatalf("week = %s", week)
	}
}

func TestFixtureRequestsDoNotExposeSecretsOrFollowRedirects(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v2/redirect" {
			http.Redirect(w, r, "/private-token", http.StatusTemporaryRedirect)
			return
		}
		http.Error(w, "private-token", http.StatusForbidden)
	}))
	t.Cleanup(server.Close)
	api := &fixtureAPI{baseURL: server.URL, token: "private-token"}
	for _, path := range []string{"/error", "/redirect"} {
		err := api.request(t.Context(), http.MethodPost, path, map[string]string{"password": "private-password"}, nil)
		if err == nil || strings.Contains(err.Error(), "private-") {
			t.Fatalf("unsafe error: %v", err)
		}
	}
}
