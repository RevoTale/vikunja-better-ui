package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestPlanningWeekIncludesEndOnlyAndChoosesEligibleDateOnce(t *testing.T) {
	t.Parallel()
	date := func(day int) time.Time { return time.Date(2026, time.November, day, 12, 0, 0, 0, time.UTC) }
	tasks := []vikunja.Task{
		{ID: 1, EndDate: date(3)},
		{ID: 2, EndDate: date(1), DueDate: date(5)},
		{ID: 3, EndDate: date(4), DueDate: date(6)},
		{ID: 4, StartDate: date(2), EndDate: date(30)},
	}
	view := BuildWeekView(tasks, WeekRequest{Now: date(3), Location: time.UTC, WeekStart: time.Monday})
	if !view.IsComplete || len(view.Days) != 7 {
		t.Fatalf("week = %#v", view)
	}
	assertTaskIDs(t, view.Days[1].Items, 1)
	assertTaskIDs(t, view.Days[2].Items, 3)
	assertTaskIDs(t, view.Days[3].Items, 2)
	assertTaskIDs(t, view.Days[4].Items)
}
