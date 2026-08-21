package service

import (
	"context"
	"errors"
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
