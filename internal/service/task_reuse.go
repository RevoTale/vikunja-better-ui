package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type taskReuseClient interface {
	Labels(context.Context) ([]vikunja.Label, error)
	TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error)
}

// LatestCreatedTask reads one page at a time without retaining task history.
func LatestCreatedTask(ctx context.Context, client taskReuseClient, authorID int64, job, recurring bool) (*vikunja.Task, error) {
	if authorID <= 0 {
		return nil, ErrTaskNotAccessible
	}
	labels, err := client.Labels(ctx)
	if err != nil {
		return nil, err
	}
	jobIDs := ExactLabelIDs(labels, jobLabel)
	if job && len(jobIDs) == 0 {
		return nil, nil
	}
	filters := []string{fmt.Sprintf("created_by_id = %d", authorID)}
	// Vikunja 2.5 cannot filter repeat_mode. Check recurrence below so monthly
	// tasks with repeat_after=0 are not lost.
	if len(jobIDs) > 0 {
		operator := " not in "
		if job {
			operator = " in "
		}
		filters = append(filters, "labels"+operator+joinIDs(jobIDs))
	}
	if ids := ExactLabelIDs(labels, recurrenceHistoryLabel); len(ids) > 0 {
		filters = append(filters, "labels not in "+joinIDs(ids))
	}
	query := vikunja.TaskQuery{Page: 1, PerPage: 50, Filter: strings.Join(filters, " && "), SortBy: []string{"created", "id"}, OrderBy: []string{"desc", "desc"}}
	for {
		page, readErr := client.TasksPage(ctx, query)
		if readErr != nil {
			return nil, readErr
		}
		for _, task := range page.Items {
			if task.CreatedBy.ID != authorID || hasLabel(task.Labels, recurrenceHistoryLabel) {
				continue
			}
			kind := ClassifyTask(task)
			if kind.Kind != TaskKindInvalid && (kind.Kind == TaskKindJob) == job && kind.Recurring == recurring {
				return &task, nil
			}
		}
		if len(page.Items) == 0 || query.Page >= page.TotalPages {
			return nil, nil
		}
		query.Page++
	}
}
