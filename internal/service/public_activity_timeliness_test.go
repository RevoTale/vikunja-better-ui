package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestActivityOnTimeCompletionUsesAbsoluteDueInstant(t *testing.T) {
	t.Parallel()
	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	// The two local 03:30 times during the DST rollback are different instants.
	start := time.Date(2026, 10, 25, 0, 0, 0, 0, location)
	due := time.Date(2026, 10, 25, 0, 30, 0, 0, time.UTC)
	for _, scenario := range []struct {
		name     string
		done     time.Time
		deadline time.Time
		labels   []vikunja.Label
		active   bool
		count    int
		eligible int
		onTime   int
	}{
		{name: "early", done: due.Add(-time.Second), deadline: due, count: 1, eligible: 1, onTime: 1},
		{name: "exact", done: due, deadline: due, count: 1, eligible: 1, onTime: 1},
		{name: "late DST hour", done: due.Add(time.Hour), deadline: due, count: 1, eligible: 1},
		{name: "missing deadline", done: due, count: 1},
		{name: "history retains old due", done: due.Add(time.Hour), deadline: due,
			labels: []vikunja.Label{{Title: recurrenceHistoryLabel}}, count: 1, eligible: 1},
		{name: "skip excluded", done: due, deadline: due, labels: []vikunja.Label{{Title: skippedLabel}}},
		{name: "live excluded", done: due, deadline: due, active: true},
		{name: "outside window", done: start.Add(-time.Second), deadline: due},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			t.Parallel()
			summary := ActivitySummary{Days: [activityDays]ActivityDay{{Date: "2026-10-25"}}}
			task := vikunja.ActivityTask{Done: !scenario.active, DoneAt: scenario.done,
				DueDate: scenario.deadline, Labels: scenario.labels}
			if err := addActivity(&summary, task, start, start.AddDate(0, 0, 1), location); err != nil {
				t.Fatal(err)
			}
			day := summary.Days[0]
			if day.Count != scenario.count || day.WithDeadlineCount != scenario.eligible || day.OnTimeCount != scenario.onTime {
				t.Fatalf("unexpected daily completion sample: %+v", day)
			}
		})
	}
}

func TestActivityTimelinessAcrossCalendarYearBoundary(t *testing.T) {
	t.Parallel()
	start := time.Date(2026, 12, 25, 0, 0, 0, 0, time.UTC)
	summary := ActivitySummary{Days: [activityDays]ActivityDay{{Date: "2026-12-25"}}}
	summary.Days[13].Date = "2027-01-07"
	instant := start.AddDate(0, 0, 13)
	if err := addActivity(&summary, vikunja.ActivityTask{Done: true, DoneAt: instant, DueDate: instant},
		start, instant.Add(time.Hour), time.UTC); err != nil {
		t.Fatal(err)
	}
	if summary.Days[13].OnTimeCount != 1 || summary.Days[0].Count != 0 {
		t.Fatalf("wrong calendar day at year boundary: %+v", summary.Days)
	}
}

func TestActivityTimelinessGroupsByCompletionDayNotDueDay(t *testing.T) {
	t.Parallel()
	start := time.Date(2026, 10, 14, 0, 0, 0, 0, time.UTC)
	summary := ActivitySummary{Days: [activityDays]ActivityDay{{Date: "2026-10-14"}, {Date: "2026-10-15"}}}
	task := vikunja.ActivityTask{Done: true, DueDate: start, DoneAt: start.Add(36 * time.Hour)}
	if err := addActivity(&summary, task, start, start.Add(48*time.Hour), time.UTC); err != nil {
		t.Fatal(err)
	}
	if summary.Days[0].WithDeadlineCount != 0 || summary.Days[1].WithDeadlineCount != 1 ||
		summary.Days[1].OnTimeCount != 0 {
		t.Fatalf("grouped by the deadline instead of completion: %+v", summary.Days)
	}
}

func TestPublicActivityOneHourCacheBoundary(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	client := &activityStub{}
	cache := NewPublicActivity(client, func() time.Time { return now })
	first, err := cache.Read(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if first.RefreshAt.Sub(first.GeneratedAt) != time.Hour {
		t.Fatalf("cache lifetime = %s, want one hour", first.RefreshAt.Sub(first.GeneratedAt))
	}
	now = now.Add(time.Hour - time.Nanosecond)
	if _, err = cache.Read(t.Context()); err != nil || client.calls != 1 {
		t.Fatalf("early cache expiry: calls %d, error %v", client.calls, err)
	}
	now = now.Add(time.Nanosecond)
	if _, err = cache.Read(t.Context()); err != nil || client.calls != 2 {
		t.Fatalf("missing refresh at expiry: calls %d, error %v", client.calls, err)
	}
}
