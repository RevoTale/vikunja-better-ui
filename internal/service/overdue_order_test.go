package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestOverdueOrderingUsesPriorityThenDueInstant(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.August, 12, 10, 0, 0, 0, time.UTC)
	tasks := []vikunja.Task{
		{ID: 1, Title: "First alphabetically", Priority: 3, StartDate: now.Add(-10 * time.Hour), EndDate: now.Add(-2 * time.Hour), DueDate: now.Add(-time.Hour), Labels: labels(jobLabel)},
		{ID: 2, Title: "Older deadline", Priority: 3, StartDate: now.Add(-5 * time.Hour), EndDate: now.Add(-4 * time.Hour), DueDate: now.Add(-3 * time.Hour), Labels: labels(jobLabel)},
		{ID: 3, Title: "Highest", Priority: 5, StartDate: now.Add(-4 * time.Hour), EndDate: now.Add(-2 * time.Hour), DueDate: now.Add(-time.Hour), Labels: labels(jobLabel)},
	}
	for _, scope := range []TaskScope{TaskScopeToday, TaskScopeWeek, TaskScopeJobs} {
		t.Run(string(scope), func(t *testing.T) {
			assertTaskIDs(t, BuildTaskList(tasks, nil, scope, now, time.UTC, time.Monday), 3, 2, 1)
		})
	}
}
