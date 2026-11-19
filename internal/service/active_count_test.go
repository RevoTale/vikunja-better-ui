package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestCountActiveWorkClassifiesEveryPage(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, kyivLocation(t))
	start, end := now.Add(-time.Hour), now.Add(time.Hour)
	pages := []vikunja.TaskPage{
		{Page: 1, Total: 6, PerPage: 3, TotalPages: 2, Items: []vikunja.Task{
			{ID: 1, StartDate: now, EndDate: end},
			{ID: 2, StartDate: start, DueDate: end, RepeatAfter: recurrenceDaySeconds},
			{ID: 3, StartDate: start, EndDate: end, Labels: []vikunja.Label{{Title: skippedLabel}}},
		}},
		{Page: 2, Total: 6, PerPage: 3, TotalPages: 2, Items: []vikunja.Task{
			{ID: 4, StartDate: start, DueDate: now, RepeatAfter: recurrenceDaySeconds,
				Labels: []vikunja.Label{{Title: recurringAvailabilityLabel}}},
			{ID: 5, StartDate: start, EndDate: now, Done: true},
			{ID: 6, StartDate: start, EndDate: now, Labels: []vikunja.Label{{Title: jobLabel}}},
		}},
	}
	client := &listClientStub{pages: pages}
	count, err := CountActiveWork(t.Context(), client, now)
	if err != nil || count != 3 {
		t.Fatalf("count = %d, error = %v", count, err)
	}
	request := ListRequest{Scope: TaskScopeActive, Now: now.UTC(), Location: time.UTC, Timezone: "UTC",
		Page: 1, PageSize: 1}
	list, err := ListTasks(t.Context(), benchmarkListClient{pages: pages}, request)
	if err != nil || !list.IsComplete || list.TotalItems != int64(count) || len(list.Items) != 1 {
		t.Fatalf("list = %+v, error = %v", list, err)
	}
	if len(client.queries) != len(pages) {
		t.Fatalf("queried %d pages, want %d", len(client.queries), len(pages))
	}
	for i, query := range client.queries {
		if query.Page != int64(i+1) || query.Filter != candidateTaskQuery(request).Filter ||
			query.FilterTimezone != "UTC" || query.IncludeCommentCount {
			t.Errorf("unexpected candidate query: %#v", query)
		}
	}
}

func TestCountActiveWorkRequiresCompletePages(t *testing.T) {
	t.Parallel()
	first := vikunja.TaskPage{Page: 1, Total: 2, PerPage: 1, TotalPages: 2, Items: []vikunja.Task{{ID: 1}}}
	for _, test := range []struct {
		name   string
		client *listClientStub
		want   error
	}{
		{"first read failed", &listClientStub{errAt: 1, err: context.Canceled}, context.Canceled},
		{"second read failed", &listClientStub{pages: []vikunja.TaskPage{first}, errAt: 2, err: context.DeadlineExceeded},
			context.DeadlineExceeded},
		{"total changed", &listClientStub{pages: []vikunja.TaskPage{first, {Total: 3, PerPage: 1, TotalPages: 3}}},
			vikunja.ErrRejectedResponse},
		{"short page", &listClientStub{pages: []vikunja.TaskPage{first, {Total: 2, PerPage: 1, TotalPages: 2}}},
			vikunja.ErrRejectedResponse},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			count, err := CountActiveWork(t.Context(), test.client, time.Now())
			if count != 0 || !errors.Is(err, test.want) {
				t.Fatalf("count = %d, error = %v", count, err)
			}
		})
	}
}

func TestCountActiveWorkRejectsOversizedAndAcceptsEmpty(t *testing.T) {
	t.Parallel()
	large := &listClientStub{pages: []vikunja.TaskPage{{Total: maxCandidateTasks + 1, TotalPages: 11}}}
	if _, err := CountActiveWork(t.Context(), large, time.Now()); err == nil || len(large.queries) != 1 {
		t.Fatalf("oversized error = %v, queries = %d", err, len(large.queries))
	}
	empty := &listClientStub{pages: []vikunja.TaskPage{{Page: 1, PerPage: upstreamTaskPageSize}}}
	if count, err := CountActiveWork(t.Context(), empty, time.Now()); count != 0 || err != nil || len(empty.queries) != 1 {
		t.Fatalf("empty count = %d, error = %v, queries = %d", count, err, len(empty.queries))
	}
}
