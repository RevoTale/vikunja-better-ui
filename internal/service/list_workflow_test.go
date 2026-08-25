package service

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestListTasksMaterializesAndGloballySortsToday(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{
			{ID: 3, Title: "Later", DueDate: now.Add(2 * time.Hour)},
			{ID: 1, Title: "Overdue low", DueDate: now.Add(-time.Hour), Priority: 1},
			{ID: 2, Title: "Overdue high", DueDate: now.Add(-2 * time.Hour), Priority: 5},
		},
		Total: 3, Page: 1, PerPage: 1000, TotalPages: 1,
	}}}
	projectID := int64(7)
	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeToday, ProjectID: &projectID, Page: 1, PageSize: 2,
		Now: now, Location: time.UTC, Timezone: "UTC", WeekStart: time.Monday,
		ProjectTitles: map[int64]string{7: "Home"},
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	assertTaskIDs(t, result.Items, 2, 1)
	if result.TotalItems != 3 || !result.HasMore || !result.IsComplete {
		t.Fatalf("ListTasks() = %#v", result)
	}
	if len(client.queries) != 1 || client.queries[0].Filter != "done = false && due_date < '2026-08-13T00:00:00Z' && project = 7" {
		t.Fatalf("query = %#v", client.queries)
	}
}

func TestListTasksUsesTheLocalDayBoundaryAcrossDST(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{}, Total: 0, Page: 1, PerPage: 1000, TotalPages: 1,
	}}}
	_, err = ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeToday, Page: 1, PageSize: 30,
		Now:      time.Date(2026, time.March, 8, 12, 0, 0, 0, time.UTC),
		Location: location, Timezone: "America/New_York", WeekStart: time.Monday,
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	if len(client.queries) != 1 {
		t.Fatalf("queries = %d", len(client.queries))
	}
	query := client.queries[0]
	if query.Filter != "done = false && due_date < '2026-03-09T00:00:00-04:00'" {
		t.Fatalf("filter = %q", query.Filter)
	}
	if query.FilterTimezone != "America/New_York" {
		t.Fatalf("filter timezone = %q", query.FilterTimezone)
	}
}

func TestListTasksReturnsOnlyRequestedActivePage(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{
			{ID: 1, DueDate: now.Add(-3 * time.Hour)},
			{ID: 2, DueDate: now.Add(-2 * time.Hour)},
			{ID: 3, DueDate: now.Add(-time.Hour)},
		},
		Total: 3, Page: 1, PerPage: 1000, TotalPages: 1,
	}}}
	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeToday, Page: 2, PageSize: 2,
		Now: now, Location: time.UTC, Timezone: "UTC", WeekStart: time.Monday,
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	assertTaskIDs(t, result.Items, 3)
}

func TestListTasksRejectsOversizedActiveCandidateSet(t *testing.T) {
	t.Parallel()

	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{{ID: 1}}, Total: 10001, Page: 1, PerPage: 1000, TotalPages: 11,
	}}}
	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeJobs, Page: 1, PageSize: 30, Now: time.Now(), Location: time.UTC, Timezone: "UTC",
		JobLabelIDs: []int64{4},
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	if result.IsComplete || len(result.Items) != 0 || result.Issue == nil || result.Issue.Code != ListIssueTooLarge {
		t.Fatalf("ListTasks() = %#v", result)
	}
	if len(client.queries) != 1 {
		t.Fatalf("queries = %d", len(client.queries))
	}
	if client.queries[0].Filter != "done = false && labels in 4 && repeat_after = 0" {
		t.Fatalf("job filter = %q", client.queries[0].Filter)
	}
}

func TestListTasksReturnsEmptyJobsWithoutMarkerLabels(t *testing.T) {
	t.Parallel()

	client := &listClientStub{}
	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeJobs, Page: 1, PageSize: 30, Now: time.Now(), Location: time.UTC, Timezone: "UTC",
	})
	if err != nil || !result.IsComplete || result.TotalItems != 0 || len(client.queries) != 0 {
		t.Fatalf("ListTasks() = %#v, %v, queries=%d", result, err, len(client.queries))
	}
}

func TestListTasksFiltersJobsByRequiredLabelBeforePagination(t *testing.T) {
	t.Parallel()

	jobLabel := vikunja.Label{ID: 4, Title: "job"}
	dashboardLabel := vikunja.Label{ID: 8, Title: "dashboard"}
	duplicateDashboardLabel := vikunja.Label{ID: 9, Title: "dashboard"}
	client := &listClientStub{pages: []vikunja.TaskPage{{
		Items: []vikunja.Task{
			{ID: 1, Title: "Excluded", Labels: []vikunja.Label{jobLabel}},
			{ID: 2, Title: "Included first", Labels: []vikunja.Label{jobLabel, dashboardLabel}},
			{ID: 3, Title: "Included second", Labels: []vikunja.Label{jobLabel, duplicateDashboardLabel}},
		},
		Total: 3, Page: 1, PerPage: 1000, TotalPages: 1,
	}}}
	result, err := ListTasks(context.Background(), client, ListRequest{
		Scope: TaskScopeJobs, Page: 1, PageSize: 1, Now: time.Now(), Location: time.UTC, Timezone: "UTC",
		JobLabelIDs: []int64{4}, FilterLabelIDs: []int64{8, 9},
	})
	if err != nil {
		t.Fatalf("ListTasks() error = %v", err)
	}
	assertTaskIDs(t, result.Items, 2)
	if result.TotalItems != 2 || !result.HasMore {
		t.Fatalf("ListTasks() = %#v", result)
	}
}

func TestListTasksFiltersSortsAndPaginatesCompletedJobs(t *testing.T) {
	t.Parallel()

	completedFrom := time.Date(2026, time.August, 24, 0, 0, 0, 0, time.FixedZone("EEST", 3*60*60))
	completedBefore := time.Date(2026, time.August, 31, 0, 0, 0, 0, time.FixedZone("EEST", 3*60*60))
	jobMarker := vikunja.Label{ID: 4, Title: "job"}
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
	wantFilter := "done = true && done_at >= '2026-08-24T00:00:00+03:00' && done_at < '2026-08-31T00:00:00+03:00' && labels in 4 && repeat_after = 0"
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
	wantFilter := "done = true && done_at >= '2026-08-24T00:00:00.123456789Z' && done_at < '2026-08-31T00:00:00.987654321Z' && labels in 4 && repeat_after = 0"
	if len(client.queries) != 1 || client.queries[0].Filter != wantFilter {
		t.Fatalf("queries = %#v", client.queries)
	}
}

func TestListTasksMergesAllJobsBeforeSortingAndPagination(t *testing.T) {
	t.Parallel()

	completedFrom := time.Date(2026, time.August, 24, 0, 0, 0, 0, time.UTC)
	completedBefore := completedFrom.AddDate(0, 0, 7)
	jobLabel := vikunja.Label{ID: 4, Title: "job"}
	client := &unifiedJobsClient{active: vikunja.TaskPage{
		Items: []vikunja.Task{
			{ID: 20, StartDate: completedFrom.Add(36 * time.Hour), DueDate: completedFrom.Add(38 * time.Hour), Labels: []vikunja.Label{jobLabel}},
			{ID: 40, Labels: []vikunja.Label{jobLabel}},
		},
		Total: 2, Page: 1, PerPage: 1000, TotalPages: 1,
	}, completed: vikunja.TaskPage{
		Items: []vikunja.Task{
			{ID: 10, Done: true, StartDate: completedFrom.Add(12 * time.Hour), DoneAt: completedFrom.Add(14 * time.Hour), Labels: []vikunja.Label{jobLabel}},
			{ID: 30, Done: true, StartDate: completedFrom.Add(48 * time.Hour), DoneAt: completedFrom.Add(50 * time.Hour), Labels: []vikunja.Label{jobLabel}},
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
	jobLabel := vikunja.Label{ID: 4, Title: "job"}
	client := &unifiedJobsClient{active: vikunja.TaskPage{
		Items: []vikunja.Task{
			{ID: 20, DueDate: completedFrom.Add(72 * time.Hour), Labels: []vikunja.Label{jobLabel}},
			{ID: 40, Labels: []vikunja.Label{jobLabel}},
		},
		Total: 2, Page: 1, PerPage: 1000, TotalPages: 1,
	}, completed: vikunja.TaskPage{
		Items: []vikunja.Task{
			{ID: 10, Done: true, DueDate: completedFrom.Add(96 * time.Hour), DoneAt: completedFrom.Add(48 * time.Hour), Labels: []vikunja.Label{jobLabel}},
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
	if len(client.queries) != 1 || client.queries[0].Page != 2 || client.queries[0].SortBy[0] != "done_at" || client.queries[0].OrderBy[1] != "desc" {
		t.Fatalf("queries = %#v", client.queries)
	}
}

type listClientStub struct {
	mu      sync.Mutex
	pages   []vikunja.TaskPage
	queries []vikunja.TaskQuery
	errAt   int
	err     error
}

func (client *listClientStub) TasksPage(_ context.Context, query vikunja.TaskQuery) (vikunja.TaskPage, error) {
	client.mu.Lock()
	defer client.mu.Unlock()
	client.queries = append(client.queries, query)
	callNumber := len(client.queries)
	if client.errAt > 0 && callNumber == client.errAt {
		return vikunja.TaskPage{}, client.err
	}
	return client.pages[callNumber-1], nil
}

type concurrentPageClient struct {
	started chan<- int64
	release <-chan struct{}
}

type unifiedJobsClient struct {
	mu        sync.Mutex
	active    vikunja.TaskPage
	completed vikunja.TaskPage
	queries   []vikunja.TaskQuery
	started   chan<- string
	release   <-chan struct{}
}

func (client *unifiedJobsClient) TasksPage(_ context.Context, query vikunja.TaskQuery) (vikunja.TaskPage, error) {
	client.mu.Lock()
	client.queries = append(client.queries, query)
	client.mu.Unlock()
	completed := strings.HasPrefix(query.Filter, "done = true")
	if client.started != nil {
		status := "active"
		if completed {
			status = "completed"
		}
		client.started <- status
		<-client.release
	}
	if completed {
		return client.completed, nil
	}
	return client.active, nil
}

func (client *unifiedJobsClient) assertReadBothStatuses(t *testing.T) {
	t.Helper()
	client.mu.Lock()
	defer client.mu.Unlock()
	if len(client.queries) != 2 {
		t.Fatalf("queries = %#v", client.queries)
	}
	if strings.HasPrefix(client.queries[0].Filter, "done = true") ==
		strings.HasPrefix(client.queries[1].Filter, "done = true") {
		t.Fatalf("queries = %#v", client.queries)
	}
}

func (client *concurrentPageClient) TasksPage(_ context.Context, query vikunja.TaskQuery) (vikunja.TaskPage, error) {
	if query.Page > 1 {
		client.started <- query.Page
		<-client.release
	}
	return vikunja.TaskPage{
		Items: []vikunja.Task{{ID: query.Page, DueDate: time.Now().Add(-time.Hour)}},
		Total: 3, Page: query.Page, PerPage: 1000, TotalPages: 3,
	}, nil
}
