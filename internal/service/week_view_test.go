package service

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestBuildWeekViewKeepsCurrentOverdueTasksInTheirDueDateDay(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := localTime(location, 2026, time.August, 12, 10, 0) // Wednesday.
	tasks := []vikunja.Task{
		{ID: 1, Title: "Before this week", DueDate: localTime(location, 2026, time.August, 9, 9, 0)},
		{ID: 2, Title: "Wednesday", DueDate: localTime(location, 2026, time.August, 12, 12, 0)},
		{ID: 3, Title: "Sunday", DueDate: localTime(location, 2026, time.August, 16, 9, 0)},
		{ID: 4, Title: "Monday overdue", DueDate: localTime(location, 2026, time.August, 10, 9, 0)},
	}

	view := BuildWeekView(tasks, WeekRequest{
		Now: now, Location: location, Timezone: "Europe/Kyiv", WeekStart: time.Monday,
	})

	if !view.Start.Equal(localTime(location, 2026, time.August, 10, 0, 0)) ||
		!view.End.Equal(localTime(location, 2026, time.August, 17, 0, 0)) {
		t.Fatalf("week range = %v..%v", view.Start, view.End)
	}
	if len(view.Days) != 7 {
		t.Fatalf("len(days) = %d, want 7", len(view.Days))
	}
	assertTaskIDs(t, view.Days[0].Items, 4)
	assertTaskIDs(t, view.Days[2].Items, 2)
	assertTaskIDs(t, view.Days[6].Items, 3)
}

func TestNextProjectedDueRejectsAnOverflowingUpstreamInterval(t *testing.T) {
	t.Parallel()

	task := vikunja.Task{
		DueDate:     time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC),
		RepeatAfter: math.MaxInt64,
	}
	if got := nextProjectedDue(task, task.DueDate); !got.IsZero() {
		t.Fatalf("nextProjectedDue() = %v, want zero", got)
	}
}

func TestListWeekLoadsAllCandidatesThroughTheSelectedWeek(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := localTime(location, 2026, time.August, 12, 10, 0)
	selected := localTime(location, 2026, time.August, 25, 0, 0)
	projectID := int64(7)
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{{ID: 2, ProjectID: projectID, DueDate: selected}},
		Total: 1, Page: 1, PerPage: 1000, TotalPages: 1,
	}}}

	result, err := ListWeek(context.Background(), client, WeekRequest{
		Now: now, Containing: selected, Location: location, Timezone: "Europe/Kyiv",
		WeekStart: time.Monday, ProjectID: &projectID,
	})
	if err != nil {
		t.Fatalf("ListWeek() error = %v", err)
	}
	if !result.IsComplete || len(client.queries) != 1 {
		t.Fatalf("ListWeek() = %#v, queries = %#v", result, client.queries)
	}
	wantFilter := "done = false && due_date < '2026-08-31T00:00:00+03:00' && " +
		"(due_date >= '2026-08-24T00:00:00+03:00' || repeat_after > 0) && project = 7"
	if client.queries[0].Filter != wantFilter || client.queries[0].FilterTimezone != "Europe/Kyiv" {
		t.Fatalf("query = %#v", client.queries[0])
	}
}

func TestWeekTaskQueryNarrowsPastAndFutureWeeksUpstream(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := localTime(location, 2026, time.August, 12, 10, 0)
	tests := []struct {
		name       string
		containing time.Time
		want       string
	}{
		{
			name:       "current week keeps only candidates inside its range",
			containing: localTime(location, 2026, time.August, 12, 0, 0),
			want: "done = false && due_date < '2026-08-17T00:00:00+03:00' && " +
				"due_date >= '2026-08-10T00:00:00+03:00'",
		},
		{
			name:       "past week keeps only real occurrences in its range",
			containing: localTime(location, 2026, time.August, 4, 0, 0),
			want: "done = false && due_date < '2026-08-10T00:00:00+03:00' && " +
				"due_date >= '2026-08-03T00:00:00+03:00'",
		},
		{
			name:       "future week also keeps earlier recurrence sources",
			containing: localTime(location, 2026, time.August, 25, 0, 0),
			want: "done = false && due_date < '2026-08-31T00:00:00+03:00' && " +
				"(due_date >= '2026-08-24T00:00:00+03:00' || repeat_after > 0)",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			request := WeekRequest{
				Now: now, Containing: testCase.containing, Location: location,
				Timezone: "Europe/Kyiv", WeekStart: time.Monday,
			}
			start, end := requestedWeekRange(request)
			if got := weekTaskQuery(request, start, end).Filter; got != testCase.want {
				t.Fatalf("filter = %q, want %q", got, testCase.want)
			}
		})
	}
}

func TestBuildWeekViewIgnoresTasksOutsideTheSelectedWeek(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := localTime(location, 2026, time.August, 12, 10, 0)
	selected := localTime(location, 2026, time.August, 25, 0, 0)
	tasks := []vikunja.Task{
		{ID: 1, DueDate: localTime(location, 2026, time.August, 12, 9, 0)},
		{ID: 2, DueDate: localTime(location, 2026, time.August, 25, 9, 0)},
	}

	view := BuildWeekView(tasks, WeekRequest{
		Now: now, Containing: selected, Location: location, Timezone: "Europe/Kyiv", WeekStart: time.Monday,
	})

	assertTaskIDs(t, view.Days[1].Items, 2)
}

func TestBuildWeekViewProjectsOnlyDeterministicFutureScheduledCycles(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := localTime(location, 2026, time.August, 12, 10, 0)
	tasks := []vikunja.Task{
		{
			ID: 1, Title: "Scheduled", DueDate: localTime(location, 2026, time.August, 12, 12, 0),
			RepeatAfter: 2 * 86400, RepeatMode: 0,
		},
		{
			ID: 2, Title: "From completion", DueDate: localTime(location, 2026, time.August, 12, 13, 0),
			RepeatAfter: 2 * 86400, RepeatMode: 2,
		},
		{
			ID: 3, Title: "Overdue scheduled", DueDate: localTime(location, 2026, time.August, 10, 9, 0),
			RepeatAfter: 86400, RepeatMode: 0,
		},
		{
			ID: 4, Title: "Overdue from completion", DueDate: localTime(location, 2026, time.August, 9, 9, 0),
			RepeatAfter: 86400, RepeatMode: 2,
		},
	}

	view := BuildWeekView(tasks, WeekRequest{
		Now: now, Location: location, Timezone: "Europe/Kyiv", WeekStart: time.Monday,
	})

	assertTaskIDs(t, view.Days[0].Items, 3)
	if got := view.Days[3].Projections; len(got) != 1 || got[0].Source.Task.ID != 3 ||
		!got[0].DueAt.Equal(localTime(location, 2026, time.August, 13, 9, 0)) {
		t.Fatalf("Thursday projections = %#v", got)
	}
	if got := view.Days[4].Projections; len(got) != 2 || got[0].Source.Task.ID != 3 ||
		got[1].Source.Task.ID != 1 ||
		!got[1].DueAt.Equal(localTime(location, 2026, time.August, 14, 12, 0)) {
		t.Fatalf("Friday projections = %#v", got)
	}
	if got := view.Days[6].Projections; len(got) != 2 || got[0].Source.Task.ID != 3 ||
		got[1].Source.Task.ID != 1 {
		t.Fatalf("Sunday projections = %#v", got)
	}
	for _, day := range view.Days {
		for _, projection := range day.Projections {
			if projection.Source.Task.ID == 2 || projection.Source.Task.ID == 4 ||
				projection.DueAt.Before(now) {
				t.Fatalf("non-deterministic projection = %#v", projection)
			}
		}
	}
}

func TestBuildWeekViewProjectsWholeRecurringJobSchedule(t *testing.T) {
	t.Parallel()

	location := mustLocation(t, "Europe/Kyiv")
	now := localTime(location, 2026, time.August, 12, 10, 0)
	start := localTime(location, 2026, time.August, 12, 18, 0)
	task := recurringJobAt(start, 2*recurrenceDaySeconds, 0)
	task.ID = 5

	view := BuildWeekView([]vikunja.Task{task}, WeekRequest{
		Now: now, Location: location, Timezone: "Europe/Kyiv", WeekStart: time.Monday,
	})

	projections := view.Days[4].Projections
	if len(projections) != 1 {
		t.Fatalf("Friday projections = %#v", projections)
	}
	projection := projections[0]
	if !projection.StartAt.Equal(localTime(location, 2026, time.August, 14, 18, 0)) ||
		!projection.EndAt.Equal(localTime(location, 2026, time.August, 14, 19, 0)) ||
		!projection.DueAt.Equal(localTime(location, 2026, time.August, 14, 20, 0)) {
		t.Fatalf("projection = %#v", projection)
	}
}
