package service

import (
	"slices"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestBuildTaskListTodayFiltersAndSortsGroups(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := time.Date(2026, time.August, 12, 10, 0, 0, 0, location)
	tasks := []vikunja.Task{
		{ID: 6, Title: "Tomorrow", DueDate: localTime(location, 2026, time.August, 13, 9, 0), Priority: 5},
		{ID: 4, Title: "Date only low", DueDate: localTime(location, 2026, time.August, 12, 23, 59, 59), Priority: 1, Labels: labels(dateOnlyLabel)},
		{ID: 2, Title: "Timed later high", DueDate: localTime(location, 2026, time.August, 12, 15, 0), Priority: 5},
		{ID: 1, Title: "Overdue low", DueDate: localTime(location, 2026, time.August, 11, 12, 0), Priority: 1},
		{ID: 3, Title: "Timed sooner low", DueDate: localTime(location, 2026, time.August, 12, 11, 0), Priority: 1},
		{ID: 5, Title: "Date only high", DueDate: localTime(location, 2026, time.August, 12, 23, 59, 59), Priority: 5, Labels: labels(dateOnlyLabel)},
		{ID: 7, Title: "Done overdue", Done: true, DueDate: localTime(location, 2026, time.August, 10, 9, 0)},
		{ID: 8, Title: "No deadline"},
	}

	items := BuildTaskList(tasks, nil, TaskScopeToday, now, location, time.Monday)
	assertTaskIDs(t, items, 1, 3, 2, 5, 4)
}

func TestBuildTaskListWeekUsesConfiguredWeekStart(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := time.Date(2026, time.August, 12, 10, 0, 0, 0, location) // Wednesday.
	tasks := []vikunja.Task{
		{ID: 1, Title: "Overdue", DueDate: localTime(location, 2026, time.August, 1, 9, 0)},
		{ID: 2, Title: "Sunday", DueDate: localTime(location, 2026, time.August, 16, 9, 0)},
		{ID: 3, Title: "Next Monday", DueDate: localTime(location, 2026, time.August, 17, 9, 0)},
	}

	mondayWeek := BuildTaskList(tasks, nil, TaskScopeWeek, now, location, time.Monday)
	assertTaskIDs(t, mondayWeek, 1, 2)

	sundayWeek := BuildTaskList(tasks, nil, TaskScopeWeek, now, location, time.Sunday)
	assertTaskIDs(t, sundayWeek, 1)
}

func TestBuildTaskListMonthIncludesOverdueAndCurrentMonth(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := time.Date(2026, time.August, 12, 10, 0, 0, 0, location)
	tasks := []vikunja.Task{
		{ID: 1, Title: "Overdue", DueDate: localTime(location, 2026, time.July, 1, 9, 0)},
		{ID: 2, Title: "Month end", DueDate: localTime(location, 2026, time.August, 31, 23, 59)},
		{ID: 3, Title: "Next month", DueDate: localTime(location, 2026, time.September, 1, 0, 0)},
	}

	items := BuildTaskList(tasks, nil, TaskScopeMonth, now, location, time.Monday)
	assertTaskIDs(t, items, 1, 2)
}

func TestBuildTaskListJobsAndUnscheduled(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := time.Date(2026, time.August, 12, 10, 0, 0, 0, location)
	projects := map[int64]string{1: "Zulu", 2: "Alpha"}
	tasks := []vikunja.Task{
		{ID: 1, ProjectID: 1, Title: "Later job", StartDate: localTime(location, 2026, time.August, 12, 13, 0), DueDate: localTime(location, 2026, time.August, 12, 16, 0), Labels: labels(jobLabel)},
		{ID: 2, ProjectID: 1, Title: "Overdue job", StartDate: localTime(location, 2026, time.August, 11, 9, 0), DueDate: localTime(location, 2026, time.August, 11, 12, 0), Labels: labels(jobLabel)},
		{ID: 3, ProjectID: 1, Title: "Zulu low", Priority: 1},
		{ID: 4, ProjectID: 2, Title: "Alpha low", Priority: 1},
		{ID: 5, ProjectID: 2, Title: "Alpha high", Priority: 5},
	}

	jobs := BuildTaskList(tasks, projects, TaskScopeJobs, now, location, time.Monday)
	assertTaskIDs(t, jobs, 2, 1)

	unscheduled := BuildTaskList(tasks, projects, TaskScopeUnscheduled, now, location, time.Monday)
	assertTaskIDs(t, unscheduled, 5, 4, 3)
}

func TestBuildTaskListHistorySortsNewestFirst(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := time.Date(2026, time.August, 12, 10, 0, 0, 0, location)
	tasks := []vikunja.Task{
		{ID: 1, Title: "Older", Done: true, DoneAt: now.Add(-time.Hour)},
		{ID: 2, Title: "Newest lower ID", Done: true, DoneAt: now},
		{ID: 3, Title: "Newest higher ID", Done: true, DoneAt: now},
		{ID: 4, Title: "Live recurring", Done: false, DoneAt: now, RepeatAfter: 86400},
	}

	items := BuildTaskList(tasks, nil, TaskScopeHistory, now, location, time.Monday)
	assertTaskIDs(t, items, 3, 2, 1)
}

func mustLocation(t *testing.T, name string) *time.Location {
	t.Helper()
	location, err := time.LoadLocation(name)
	if err != nil {
		t.Fatalf("time.LoadLocation() error = %v", err)
	}
	return location
}

func localTime(location *time.Location, year int, month time.Month, day int, hour int, minute int, seconds ...int) time.Time {
	second := 0
	if len(seconds) == 1 {
		second = seconds[0]
	}
	return time.Date(year, month, day, hour, minute, second, 0, location)
}

func labels(titles ...string) []vikunja.Label {
	result := make([]vikunja.Label, 0, len(titles))
	for index, title := range titles {
		result = append(result, vikunja.Label{ID: int64(index + 1), Title: title})
	}
	return result
}

func assertTaskIDs(t *testing.T, items []TaskListItem, want ...int64) {
	t.Helper()
	if len(items) != len(want) {
		t.Fatalf("len(items) = %d, want %d; items = %#v", len(items), len(want), items)
	}
	got := make([]int64, 0, len(items))
	for _, item := range items {
		got = append(got, item.Task.ID)
	}
	if !slices.Equal(got, want) {
		t.Fatalf("task IDs = %v, want %v", got, want)
	}
}
