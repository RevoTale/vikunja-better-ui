package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestListTasksLoadsActiveAndCompletedJobsConcurrently(t *testing.T) {
	t.Parallel()

	completedFrom := time.Date(2026, time.August, 24, 0, 0, 0, 0, time.UTC)
	started := make(chan string, 2)
	release := make(chan struct{})
	client := &unifiedJobsClient{
		active:    vikunja.TaskPage{Page: 1, PerPage: 1000},
		completed: vikunja.TaskPage{Page: 1, PerPage: 1000},
		started:   started, release: release,
	}
	done := make(chan error, 1)
	go func() {
		_, err := ListTasks(t.Context(), client, ListRequest{
			Scope: TaskScopeAllJobs, Page: 1, PageSize: 30, Now: completedFrom,
			Location: time.UTC, Timezone: "UTC", JobLabelIDs: []int64{4},
			CompletedFrom: completedFrom, CompletedBefore: completedFrom.AddDate(0, 0, 7),
			JobSort: JobSortStartAt, SortOrder: SortAscending,
		})
		done <- err
	}()

	seen := make(map[string]bool, 2)
	timer := time.NewTimer(200 * time.Millisecond)
	for len(seen) < 2 {
		select {
		case status := <-started:
			seen[status] = true
		case <-timer.C:
			close(release)
			if err := <-done; err != nil {
				t.Fatalf("ListTasks() error = %v", err)
			}
			t.Fatalf("task reads did not overlap: started = %v", seen)
		}
	}
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	close(release)
	if err := <-done; err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
}

func TestListTasksRejectsOversizedCombinedJobSetBeforeLoadingMorePages(t *testing.T) {
	t.Parallel()

	completedFrom := time.Date(2026, time.August, 24, 0, 0, 0, 0, time.UTC)
	client := &unifiedJobsClient{
		active: vikunja.TaskPage{
			Items: []vikunja.Task{{ID: 1}}, Total: 5001, Page: 1, PerPage: 1000, TotalPages: 6,
		},
		completed: vikunja.TaskPage{
			Items: []vikunja.Task{{ID: 2}}, Total: 5000, Page: 1, PerPage: 1000, TotalPages: 5,
		},
	}
	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeAllJobs, Page: 1, PageSize: 30, Now: completedFrom,
		Location: time.UTC, Timezone: "UTC", JobLabelIDs: []int64{4},
		CompletedFrom: completedFrom, CompletedBefore: completedFrom.AddDate(0, 0, 7),
		JobSort: JobSortStartAt, SortOrder: SortAscending,
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	if result.IsComplete || result.Issue == nil || result.Issue.Code != ListIssueTooLarge {
		t.Fatalf("ListTasks() = %#v", result)
	}
	client.assertReadBothStatuses(t)
}

func TestListTasksReturnsNoPartialRowsOnUpstreamInterruption(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("connection lost")
	client := &listClientStub{
		pages: []vikunja.TaskPage{{Items: []vikunja.Task{{ID: 1}}, Total: 1001, Page: 1, PerPage: 1000, TotalPages: 2}},
		errAt: 2, err: wantErr,
	}
	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeJobs, Page: 1, PageSize: 30, Now: time.Now(), Location: time.UTC, Timezone: "UTC",
		JobLabelIDs: []int64{4},
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	if result.IsComplete || len(result.Items) != 0 || result.Issue == nil ||
		result.Issue.Code != ListIssueUpstreamPartial || !errors.Is(result.Issue.Cause, wantErr) {
		t.Fatalf("ListTasks() = %#v", result)
	}
}

func TestListTasksLoadsRemainingPagesConcurrently(t *testing.T) {
	t.Parallel()

	started := make(chan int64, 2)
	release := make(chan struct{})
	client := &concurrentPageClient{started: started, release: release}
	done := make(chan error, 1)
	go func() {
		_, err := ListTasks(t.Context(), client, ListRequest{
			Scope: TaskScopeToday, Page: 1, PageSize: 30,
			Now: time.Now(), Location: time.UTC, Timezone: "UTC", WeekStart: time.Monday,
		})
		done <- err
	}()

	seen := make(map[int64]bool, 2)
	timer := time.NewTimer(200 * time.Millisecond)
	for len(seen) < 2 {
		select {
		case page := <-started:
			seen[page] = true
		case <-timer.C:
			close(release)
			if err := <-done; err != nil {
				t.Fatalf("ListTasks() error = %v", err)
			}
			t.Fatalf("remaining pages did not overlap: started = %v", seen)
		}
	}
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	close(release)
	if err := <-done; err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
}

func TestListTasksHistoryReadsRequestedPagesInAuthoritativeOrder(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{{ID: 2, Done: true, DoneAt: now.Add(-time.Hour)}},
		Total: 2, Page: 2, PerPage: 1, TotalPages: 2,
	}}}
	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeHistory, Page: 2, PageSize: 1, Now: now, Location: time.UTC, Timezone: "UTC",
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	assertTaskIDs(t, result.Items, 2)
	if len(client.queries) != 1 || client.queries[0].Page != 2 ||
		client.queries[0].SortBy[0] != "done_at" ||
		client.queries[0].OrderBy[1] != "desc" {
		t.Fatalf("queries = %#v", client.queries)
	}
}
