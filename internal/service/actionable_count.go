package service

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// CountActionableTasks counts unfinished tasks whose deadline passed or start has arrived.
// Vikunja applies the predicate and returns the total; only one task is transferred.
func CountActionableTasks(ctx context.Context, client taskListClient, now time.Time) (int64, error) {
	instant := now.UTC().Format(time.RFC3339Nano)
	page, err := client.TasksPage(ctx, vikunja.TaskQuery{
		Page: 1, PerPage: 1,
		Filter:         "done = false && (due_date < '" + instant + "' || start_date <= '" + instant + "')",
		FilterTimezone: "UTC", FilterIncludeNulls: new(false),
	})
	if err != nil {
		return 0, err
	}
	return page.Total, nil
}
