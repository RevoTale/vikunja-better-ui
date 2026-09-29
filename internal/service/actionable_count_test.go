package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestCountActionableTasksUsesOneBoundedQuery(t *testing.T) {
	client := &listClientStub{pages: []vikunja.TaskPage{{Total: 12345}}}
	now := time.Date(2026, time.September, 29, 12, 0, 0, 0, time.FixedZone("test", 3*60*60))
	count, err := CountActionableTasks(t.Context(), client, now)
	if err != nil || count != 12345 || len(client.queries) != 1 {
		t.Fatalf("count = %d, error = %v, calls = %d", count, err, len(client.queries))
	}
	query := client.queries[0]
	want := "done = false && (due_date < '2026-09-29T09:00:00Z' || start_date <= '2026-09-29T09:00:00Z')"
	if query.Filter != want || query.FilterIncludeNulls == nil || *query.FilterIncludeNulls ||
		query.Page != 1 || query.PerPage != 1 || query.IncludeCommentCount {
		t.Fatalf("query = %#v", query)
	}
}

func TestCountActionableTasksDoesNotReplaceFailureWithZero(t *testing.T) {
	client := &listClientStub{errAt: 1, err: context.DeadlineExceeded}
	_, err := CountActionableTasks(t.Context(), client, time.Now())
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("error = %v", err)
	}
}
