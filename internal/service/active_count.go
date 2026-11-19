package service

import (
	"context"
	"errors"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	"golang.org/x/sync/errgroup"
)

// CountActiveWork counts the caller's unfiltered ACTIVE tasks using one time boundary.
// Overlapping pages or changed pagination cannot confirm a count.
func CountActiveWork(ctx context.Context, client taskListClient, now time.Time) (int, error) {
	query := candidateTaskQuery(ListRequest{Scope: TaskScopeActive, Now: now.UTC(), Timezone: "UTC"})
	query.SortBy, query.OrderBy = []string{"id"}, []string{string(SortAscending)}
	first, err := client.TasksPage(ctx, query)
	if err != nil {
		return 0, err
	}
	if first.Total > maxCandidateTasks {
		return 0, errors.New("active work candidate limit exceeded")
	}
	summary, err := summarizeActivePage(first.Items, now)
	if err != nil {
		return 0, err
	}
	first.Items = nil
	remaining := make([]activePageSummary, max(first.TotalPages-1, 0))
	if len(remaining) > 0 {
		group, groupCtx := errgroup.WithContext(ctx)
		group.SetLimit(maxPageConcurrency)
		visit := func(index int64, page vikunja.TaskPage) error {
			if !sameCandidatePagination(page, first) {
				return vikunja.ErrRejectedResponse
			}
			result, pageErr := summarizeActivePage(page.Items, now)
			remaining[index] = result
			return pageErr
		}
		scheduleCandidatePages(groupCtx, group, client, query, first.TotalPages, visit)
		if err := group.Wait(); err != nil {
			return 0, err
		}
	}
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	for _, page := range remaining {
		if page.firstID <= summary.lastID {
			return 0, vikunja.ErrRejectedResponse
		}
		summary.active += page.active
		summary.loaded += page.loaded
		summary.lastID = page.lastID
	}
	if summary.loaded != first.Total {
		return 0, vikunja.ErrRejectedResponse
	}
	return summary.active, nil
}

type activePageSummary struct {
	firstID, lastID, loaded int64
	active                  int
}

func summarizeActivePage(tasks []vikunja.Task, now time.Time) (activePageSummary, error) {
	summary := activePageSummary{loaded: int64(len(tasks))}
	if len(tasks) > 0 {
		summary.firstID = tasks[0].ID
	}
	for index := range tasks {
		task := &tasks[index]
		if task.ID <= summary.lastID {
			return activePageSummary{}, vikunja.ErrRejectedResponse
		}
		summary.lastID = task.ID
		if matchesActiveWork(*task, ClassifyTask(*task), now) {
			summary.active++
		}
	}
	return summary, nil
}
