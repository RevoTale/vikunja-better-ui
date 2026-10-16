package service

import (
	"context"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestPriorityFiltersCandidatesBeforePagination(t *testing.T) {
	t.Parallel()
	for _, scope := range []TaskScope{TaskScopeToday, TaskScopeLongTerm, TaskScopeJobs} {
		for _, priority := range []int64{0, 3} {
			t.Run(string(scope)+strconv.FormatInt(priority, 10), func(t *testing.T) {
				t.Parallel()
				now := time.Date(2026, time.October, 1, 12, 0, 0, 0, time.UTC)
				tasks := priorityFixtureTasks(scope, priority, now)
				client := &listClientStub{pages: []vikunja.TaskPage{{
					Items: tasks, Total: 3, TotalPages: 1, Page: 1, PerPage: 1000,
				}}}
				result, err := ListTasks(context.Background(), client, ListRequest{
					Scope: scope, Priority: &priority, JobLabelIDs: []int64{9},
					Page: 2, PageSize: 1, Now: now, Location: time.UTC, Timezone: "UTC",
				})
				if err != nil || !result.IsComplete || result.TotalItems != 2 || len(result.Items) != 1 {
					t.Fatalf("priority pagination: result=%+v error=%v", result, err)
				}
				if result.Items[0].Task.Priority != priority || len(client.queries) != 1 ||
					!strings.Contains(client.queries[0].Filter, "priority = "+strconv.FormatInt(priority, 10)) {
					t.Fatalf("priority not filtered upstream and locally: %+v", client.queries)
				}
			})
		}
	}
}

func priorityFixtureTasks(scope TaskScope, priority int64, due time.Time) []vikunja.Task {
	if scope == TaskScopeLongTerm {
		due = due.AddDate(0, 0, 10)
	}
	tasks := []vikunja.Task{
		{ID: 1, Priority: priority, DueDate: due},
		{ID: 2, Priority: 5, DueDate: due},
		{ID: 3, Priority: priority, DueDate: due},
	}
	if scope == TaskScopeJobs {
		for index := range tasks {
			tasks[index].Labels = []vikunja.Label{{ID: 9, Title: "vbu:job"}}
		}
	}
	return tasks
}

func TestPriorityFiltersRealAndComputedDayItems(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 1, 12, 0, 0, 0, time.UTC)
	priority := int64(3)
	request := WeekRequest{Now: now, Containing: now.AddDate(0, 0, 1), Location: time.UTC,
		Timezone: "UTC", Priority: &priority}
	tasks := []vikunja.Task{
		{ID: 1, Priority: 3, DueDate: now, RepeatAfter: 86400},
		{ID: 2, Priority: 0, DueDate: now, RepeatAfter: 86400},
		{ID: 3, Priority: 3, DueDate: request.Containing},
		{ID: 4, Priority: 0, DueDate: request.Containing},
	}
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: tasks, Total: 4, TotalPages: 1, Page: 1, PerPage: 1000,
	}}}
	result, err := ListDay(context.Background(), client, request)
	if err != nil || !result.IsComplete || len(result.Days[0].Items) != 1 ||
		len(result.Days[0].Projections) != 1 || len(client.queries) != 1 ||
		!strings.Contains(client.queries[0].Filter, "priority = 3") {
		t.Fatalf("day priority filtering: result=%+v error=%v queries=%+v", result, err, client.queries)
	}
	day := result.Days[0]
	if day.Items[0].Task.ID != 3 || day.Projections[0].Source.Task.ID != 1 {
		t.Fatalf("wrong real task or computed source selected: %+v", day)
	}
}

func TestPriorityRejectsInvalidValuesBeforeRequests(t *testing.T) {
	t.Parallel()
	for _, priority := range []int64{-1, 6} {
		client := &listClientStub{}
		_, err := ListTasks(context.Background(), client, ListRequest{
			Scope: TaskScopeToday, Priority: &priority, Page: 1, PageSize: 30,
			Location: time.UTC, Timezone: "UTC",
		})
		if err == nil || len(client.queries) != 0 {
			t.Fatalf("invalid priority %d was accepted: %v", priority, err)
		}
		_, err = ListDay(context.Background(), client, WeekRequest{
			Priority: &priority, Location: time.UTC, Timezone: "UTC",
		})
		if err == nil || len(client.queries) != 0 {
			t.Fatalf("invalid day priority %d was accepted: %v", priority, err)
		}
	}
}
