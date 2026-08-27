package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestRecurringJobScheduleFromCompletionUsesExactElapsedInterval(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 12, 9, 0, 0, 0, time.UTC)
	before := recurringJobAt(
		time.Date(2026, time.August, 10, 20, 0, 0, 0, time.UTC),
		2*recurrenceDaySeconds,
		2,
	)

	target, err := targetRecurringJobSchedule(before, completedAt, time.UTC)
	if err != nil {
		t.Fatalf("targetRecurringJobSchedule() error = %v", err)
	}
	wantStart := time.Date(2026, time.August, 14, 9, 0, 0, 0, time.UTC)
	assertJobSchedule(t, target, wantStart, wantStart.Add(time.Hour), wantStart.Add(2*time.Hour))
}

func TestRecurringJobScheduleKeepsStartTimeOfDayAcrossDST(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	completedAt := time.Date(2026, time.October, 24, 10, 0, 0, 0, location)
	before := recurringJobAt(
		time.Date(2026, time.October, 24, 20, 0, 0, 0, location),
		recurrenceDaySeconds,
		2,
	)
	before.Labels = append(before.Labels, vikunja.Label{ID: 2, Title: fixedDueTimeLabel})

	target, err := targetRecurringJobSchedule(before, completedAt, location)
	if err != nil {
		t.Fatalf("targetRecurringJobSchedule() error = %v", err)
	}
	wantStart := time.Date(2026, time.October, 25, 20, 0, 0, 0, location)
	assertJobSchedule(t, target, wantStart, wantStart.Add(time.Hour), wantStart.Add(2*time.Hour))
}

func TestRecurringJobScheduleAdvancesOverdueScheduledCyclesFromStart(t *testing.T) {
	t.Parallel()

	before := recurringJobAt(
		time.Date(2026, time.August, 10, 9, 0, 0, 0, time.UTC),
		2*recurrenceDaySeconds,
		0,
	)
	completedAt := time.Date(2026, time.August, 15, 12, 0, 0, 0, time.UTC)

	target, err := targetRecurringJobSchedule(before, completedAt, time.UTC)
	if err != nil {
		t.Fatalf("targetRecurringJobSchedule() error = %v", err)
	}
	wantStart := time.Date(2026, time.August, 16, 9, 0, 0, 0, time.UTC)
	assertJobSchedule(t, target, wantStart, wantStart.Add(time.Hour), wantStart.Add(2*time.Hour))
}

func recurringJobAt(start time.Time, repeatAfter int64, repeatMode int) vikunja.Task {
	return vikunja.Task{
		StartDate:   start,
		EndDate:     start.Add(time.Hour),
		DueDate:     start.Add(2 * time.Hour),
		RepeatAfter: repeatAfter,
		RepeatMode:  repeatMode,
		Labels:      []vikunja.Label{{ID: 1, Title: jobLabel}},
	}
}

func assertJobSchedule(t *testing.T, schedule jobSchedule, start time.Time, end time.Time, due time.Time) {
	t.Helper()
	if !schedule.StartAt.Equal(start) || !schedule.EndAt.Equal(end) || !schedule.DueAt.Equal(due) {
		t.Fatalf("schedule = %#v, want start=%s end=%s due=%s", schedule, start, end, due)
	}
}
