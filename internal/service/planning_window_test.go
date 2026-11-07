package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestPlanningWindowUsesLocalCalendarBoundaries(t *testing.T) {
	t.Parallel()
	location := kyivLocation(t)
	for _, day := range []string{"2026-03-29", "2026-10-25", "2028-02-29"} {
		t.Run(day, func(t *testing.T) {
			t.Parallel()
			write, _, err := BuildOneTimeTask(OneTimeInput{
				Title: "Flexible work", Planning: &PlanningWindowInput{StartsOn: day, EndsOn: day},
			}, location)
			if err != nil {
				t.Fatal(err)
			}
			if write.StartDate.Format(time.RFC3339)[:10] != day || write.StartDate.Format("15:04:05") != "00:00:00" ||
				write.EndDate.Format("15:04:05") != "23:59:59" || write.DueDate != nil {
				t.Fatalf("incorrect window: %#v", write)
			}
			if day == "2026-03-29" && write.EndDate.Sub(*write.StartDate) != 23*time.Hour-time.Second {
				t.Fatal("spring window must follow the 23-hour local day")
			}
			if day == "2026-10-25" && write.EndDate.Sub(*write.StartDate) != 25*time.Hour-time.Second {
				t.Fatal("autumn window must follow the 25-hour local day")
			}
		})
	}
}

func TestPlanningWindowRejectsInvalidDatesWithoutMovingDeadline(t *testing.T) {
	t.Parallel()
	for _, window := range []PlanningWindowInput{
		{StartsOn: "", EndsOn: "2026-11-30"},
		{StartsOn: "2026-11-01", EndsOn: ""},
		{StartsOn: "2026-11-30", EndsOn: "2026-11-01"},
		{StartsOn: "2026-02-29", EndsOn: "2026-03-01"},
		{StartsOn: "2026-11-01", EndsOn: "2026-12-06"},
	} {
		_, _, err := BuildOneTimeTask(OneTimeInput{
			Title: "Website", Planning: &window, DueDate: "2026-12-05", DueTime: "12:00",
		}, time.UTC)
		if err == nil {
			t.Errorf("accepted invalid window: %+v", window)
		}
	}
	write, _, err := BuildOneTimeTask(OneTimeInput{
		Title: "Website", Planning: &PlanningWindowInput{StartsOn: "2026-11-01", EndsOn: "2026-12-05"},
		DueDate: "2026-12-05", DueTime: "12:00",
	}, time.UTC)
	if err != nil || write.DueDate.Format(time.RFC3339) != "2026-12-05T12:00:00Z" {
		t.Fatalf("same-day deadline was changed or rejected: %v, %#v", err, write)
	}
}

func TestTodayAndActiveDistinguishWindowFromFinish(t *testing.T) {
	t.Parallel()
	location := kyivLocation(t)
	now := localTime(location, 2026, time.November, 3, 12, 0)
	tasks := []vikunja.Task{
		{ID: 1, StartDate: now.AddDate(0, 0, -1), EndDate: now.AddDate(0, 0, 27)},
		{ID: 2, EndDate: now.Add(time.Hour)},
		{ID: 3, EndDate: now.AddDate(0, 0, -1)},
		{ID: 4, StartDate: now.Add(time.Hour), EndDate: now.AddDate(0, 0, 2)},
		{ID: 5, StartDate: now.Add(-time.Hour)},
		{ID: 6, StartDate: now.Add(-time.Hour), EndDate: now.Add(time.Hour), Done: true},
		{ID: 7, DueDate: now.Add(time.Hour)},
		{ID: 8, EndDate: now.Add(time.Hour), DueDate: now.Add(time.Hour)},
		{ID: 9, StartDate: now.Add(time.Hour), EndDate: now.Add(-time.Hour)},
	}
	assertTaskIDs(t, BuildTaskList(tasks, nil, TaskScopeActive, now, location, time.Monday), 1)
	assertTaskIDs(t, BuildTaskList(tasks[:8], nil, TaskScopeToday, now, location, time.Monday), 3, 2, 7, 8)
}

func TestPlanningDoesNotChangeJobOrRecurringTodayPolicy(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	tasks := []vikunja.Task{
		{ID: 1, EndDate: now, DueDate: now.AddDate(0, 0, 1), Labels: labels(jobLabel)},
		{ID: 2, EndDate: now, DueDate: now.AddDate(0, 0, 1), RepeatAfter: 86400},
	}
	assertTaskIDs(t, BuildTaskList(tasks, nil, TaskScopeToday, now, time.UTC, time.Monday))
}
