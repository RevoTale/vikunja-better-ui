package service

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestListTasksFiltersSortsAndPaginatesCompletedJobs(t *testing.T) {
	t.Parallel()

	completedFrom := time.Date(2026, time.August, 24, 0, 0, 0, 0, time.FixedZone("EEST", 3*60*60))
	completedBefore := time.Date(2026, time.August, 31, 0, 0, 0, 0, time.FixedZone("EEST", 3*60*60))
	jobMarker := vikunja.Label{ID: 4, Title: "vbu:job"}
	dashboardLabel := vikunja.Label{ID: 8, Title: "dashboard"}
	duplicateDashboardLabel := vikunja.Label{ID: 9, Title: "dashboard"}
	newest := completedFrom.Add(5 * 24 * time.Hour)
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{
			{ID: 1, Done: true, DoneAt: completedFrom, Labels: []vikunja.Label{jobMarker, dashboardLabel}},
			{ID: 2, Done: true, DoneAt: completedBefore, Labels: []vikunja.Label{jobMarker, dashboardLabel}},
			{ID: 3, Done: true, DoneAt: newest, Labels: []vikunja.Label{jobMarker, dashboardLabel}},
			{ID: 4, Done: true, DoneAt: newest, RepeatAfter: 86400, Labels: []vikunja.Label{jobMarker, dashboardLabel}},
			{ID: 5, Done: true, DoneAt: newest, Labels: []vikunja.Label{dashboardLabel}},
			{ID: 6, Done: true, DoneAt: newest, Labels: []vikunja.Label{jobMarker}},
			{ID: 7, Done: true, DoneAt: newest, Labels: []vikunja.Label{jobMarker, duplicateDashboardLabel}},
		},
		Total: 7, Page: 1, PerPage: 1000, TotalPages: 1,
	}}}
	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeCompletedJobs, Page: 1, PageSize: 2, Now: completedBefore,
		Location: time.UTC, Timezone: "UTC", JobLabelIDs: []int64{4}, FilterLabelIDs: []int64{8, 9},
		CompletedFrom: completedFrom, CompletedBefore: completedBefore,
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	assertTaskIDs(t, result.Items, 7, 3)
	if result.TotalItems != 3 || !result.HasMore || !result.IsComplete {
		t.Fatalf("ListTasks() = %#v", result)
	}
	if len(client.queries) != 1 {
		t.Fatalf("queries = %#v", client.queries)
	}
	query := client.queries[0]
	wantFilter := "done = true && done_at >= '2026-08-24T00:00:00+03:00' && " +
		"done_at < '2026-08-31T00:00:00+03:00' && labels in 4 && repeat_after = 0"
	if query.Filter != wantFilter || !slices.Equal(query.SortBy, []string{"done_at", "id"}) ||
		!slices.Equal(query.OrderBy, []string{"desc", "desc"}) {
		t.Fatalf("query = %#v", query)
	}
}

func TestListTasksPreservesFractionalCompletedJobBoundaries(t *testing.T) {
	t.Parallel()

	completedFrom := time.Date(2026, time.August, 24, 0, 0, 0, 123456789, time.UTC)
	completedBefore := time.Date(2026, time.August, 31, 0, 0, 0, 987654321, time.UTC)
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{}, Total: 0, Page: 1, PerPage: 1000, TotalPages: 1,
	}}}
	_, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeCompletedJobs, Page: 1, PageSize: 30, Now: completedBefore,
		Location: time.UTC, Timezone: "UTC", JobLabelIDs: []int64{4},
		CompletedFrom: completedFrom, CompletedBefore: completedBefore,
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	wantFilter := "done = true && done_at >= '2026-08-24T00:00:00.123456789Z' && " +
		"done_at < '2026-08-31T00:00:00.987654321Z' && labels in 4 && repeat_after = 0"
	if len(client.queries) != 1 || client.queries[0].Filter != wantFilter {
		t.Fatalf("queries = %#v", client.queries)
	}
}

func TestListTasksMergesAllJobsBeforeSortingAndPagination(t *testing.T) {
	t.Parallel()

	completedFrom := time.Date(2026, time.August, 24, 0, 0, 0, 0, time.UTC)
	completedBefore := completedFrom.AddDate(0, 0, 7)
	jobLabel := vikunja.Label{ID: 4, Title: "vbu:job"}
	client := &unifiedJobsClient{active: vikunja.TaskPage{
		Items: []vikunja.Task{
			{
				ID:        20,
				StartDate: completedFrom.Add(36 * time.Hour),
				DueDate:   completedFrom.Add(38 * time.Hour),
				Labels:    []vikunja.Label{jobLabel},
			},
			{ID: 40, Labels: []vikunja.Label{jobLabel}},
		},
		Total: 2, Page: 1, PerPage: 1000, TotalPages: 1,
	}, completed: vikunja.TaskPage{
		Items: []vikunja.Task{
			{
				ID:        10,
				Done:      true,
				StartDate: completedFrom.Add(12 * time.Hour),
				DoneAt:    completedFrom.Add(14 * time.Hour),
				Labels:    []vikunja.Label{jobLabel},
			},
			{
				ID:        30,
				Done:      true,
				StartDate: completedFrom.Add(48 * time.Hour),
				DoneAt:    completedFrom.Add(50 * time.Hour),
				Labels:    []vikunja.Label{jobLabel},
			},
		},
		Total: 2, Page: 1, PerPage: 1000, TotalPages: 1,
	}}

	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeAllJobs, Page: 1, PageSize: 2, Now: completedFrom,
		Location: time.UTC, Timezone: "UTC", JobLabelIDs: []int64{4},
		CompletedFrom: completedFrom, CompletedBefore: completedBefore,
		JobSort: JobSortStartAt, SortOrder: SortAscending,
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	assertTaskIDs(t, result.Items, 10, 20)
	if result.TotalItems != 4 || !result.HasMore || result.TotalPages != 2 {
		t.Fatalf("ListTasks() = %#v", result)
	}
	client.assertReadBothStatuses(t)
}

func TestListTasksSortsAllJobsByDerivedFinishTime(t *testing.T) {
	t.Parallel()

	completedFrom := time.Date(2026, time.August, 24, 0, 0, 0, 0, time.UTC)
	completedBefore := completedFrom.AddDate(0, 0, 7)
	jobLabel := vikunja.Label{ID: 4, Title: "vbu:job"}
	client := &unifiedJobsClient{active: vikunja.TaskPage{
		Items: []vikunja.Task{
			{ID: 20, DueDate: completedFrom.Add(72 * time.Hour), Labels: []vikunja.Label{jobLabel}},
			{ID: 40, Labels: []vikunja.Label{jobLabel}},
		},
		Total: 2, Page: 1, PerPage: 1000, TotalPages: 1,
	}, completed: vikunja.TaskPage{
		Items: []vikunja.Task{
			{
				ID:      10,
				Done:    true,
				DueDate: completedFrom.Add(96 * time.Hour),
				DoneAt:  completedFrom.Add(48 * time.Hour),
				Labels:  []vikunja.Label{jobLabel},
			},
			{ID: 30, Done: true, DoneAt: completedFrom.Add(72 * time.Hour), Labels: []vikunja.Label{jobLabel}},
		},
		Total: 2, Page: 1, PerPage: 1000, TotalPages: 1,
	}}

	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeAllJobs, Page: 1, PageSize: 10, Now: completedFrom,
		Location: time.UTC, Timezone: "UTC", JobLabelIDs: []int64{4},
		CompletedFrom: completedFrom, CompletedBefore: completedBefore,
		JobSort: JobSortFinishAt, SortOrder: SortDescending,
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	assertTaskIDs(t, result.Items, 30, 20, 10, 40)
}
