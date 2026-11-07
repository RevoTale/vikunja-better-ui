package service

import (
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestPeriodMatchesEitherFinishDateOnceAndKeepsOnlyCurrentBacklog(t *testing.T) {
	t.Parallel()
	location := kyivLocation(t)
	at := func(day int) time.Time { return localTime(location, 2026, time.November, day, 23, 59, 59) }
	tasks := []vikunja.Task{
		{ID: 1, EndDate: at(30)},
		{ID: 2, EndDate: at(30), DueDate: at(30)},
		{ID: 3, DueDate: at(31)},
		{ID: 4, EndDate: at(-1)},
		{ID: 5},
		{ID: 6, EndDate: at(30), Done: true},
		{ID: 7, EndDate: at(-1), DueDate: at(10)},
	}
	for _, test := range []struct {
		name string
		now  time.Time
		ids  []int64
	}{
		{name: "current", now: at(3), ids: []int64{4, 7, 1, 2}},
		{name: "historical", now: at(31), ids: []int64{7, 1, 2}},
		{name: "future", now: at(-2), ids: []int64{7, 1, 2}},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			client := &listClientStub{pages: []vikunja.TaskPage{{
				Items: tasks, Total: int64(len(tasks)), TotalPages: 1, Page: 1, PerPage: 1000,
			}}}
			result, err := ListTasks(t.Context(), client, ListRequest{
				Scope: TaskScopePeriod, Now: test.now, Location: location, Timezone: "Europe/Kyiv",
				PeriodFrom: at(0).Add(time.Second), PeriodBefore: at(30).Add(time.Second), Page: 1, PageSize: 30,
			})
			if err != nil || !result.IsComplete {
				t.Fatalf("list = %#v, %v", result, err)
			}
			assertTaskIDs(t, result.Items, test.ids...)
			filter := client.queries[0].Filter
			for _, field := range []string{"end_date", "due_date"} {
				bounded := strings.Contains(filter, field+" >= '2026-11-01T00:00:00+02:00'")
				if bounded != (test.name != "current") {
					t.Errorf("%s lower bound in %s query: %s", field, test.name, filter)
				}
			}
		})
	}
}

func TestTodayCandidateQueryIncludesPlanningOnlyTasks(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{{ID: 1, EndDate: now.Add(time.Hour)}},
		Total: 1, TotalPages: 1, Page: 1, PerPage: 1000,
	}}}
	result, err := ListTasks(t.Context(), client, ListRequest{
		Scope: TaskScopeToday, Now: now, Location: time.UTC, Timezone: "UTC", Page: 1, PageSize: 30,
	})
	if err != nil || !result.IsComplete || !strings.Contains(client.queries[0].Filter, "|| end_date <") {
		t.Fatalf("planned task was not queried: %#v, %v", client.queries, err)
	}
	assertTaskIDs(t, result.Items, 1)
}

func TestActiveCandidateQueryUsesExactInstant(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 3, 12, 0, 0, 500_000_000, time.UTC)
	got := planningCandidateFilter(ListRequest{Scope: TaskScopeActive, Now: now})
	stamp := "'2026-11-03T12:00:00.5Z'"
	want := "start_date <= " + stamp + " && (end_date >= " + stamp + " || (repeat_after > 0 && due_date >= " + stamp + "))"
	if got != want {
		t.Errorf("active candidate filter = %q, want %q", got, want)
	}
}

func TestActiveWindowUsesDueForManagedFlexibleRepeatOnly(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 4, 12, 0, 0, 0, time.UTC)
	task := vikunja.Task{StartDate: now.Add(-time.Hour), DueDate: now, RepeatAfter: recurrenceDaySeconds}
	if activePlanningWindow(task, now) {
		t.Fatal("legacy start-only task entered Active work")
	}
	task.Labels = []vikunja.Label{{Title: recurringAvailabilityLabel}}
	if !activePlanningWindow(task, now) || activePlanningWindow(task, now.Add(time.Second)) {
		t.Fatal("managed occurrence did not use its due boundary")
	}
}
