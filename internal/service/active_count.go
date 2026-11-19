package service

import (
	"context"
	"errors"
	"sync/atomic"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	"golang.org/x/sync/errgroup"
)

// CountActiveWork counts the caller's unfiltered ACTIVE tasks at one instant.
// Every candidate page must be read consistently before the total is returned.
func CountActiveWork(ctx context.Context, client taskListClient, now time.Time) (int, error) {
	query := candidateTaskQuery(ListRequest{Scope: TaskScopeActive, Now: now.UTC(), Timezone: "UTC"})
	first, err := client.TasksPage(ctx, query)
	if err != nil {
		return 0, err
	}
	if first.Total > maxCandidateTasks {
		return 0, errors.New("active work candidate limit exceeded")
	}
	var active, loaded atomic.Int64
	active.Store(countActiveTasks(first.Items, now))
	loaded.Store(int64(len(first.Items)))
	first.Items = nil
	if first.TotalPages > 1 {
		group, groupCtx := errgroup.WithContext(ctx)
		group.SetLimit(maxPageConcurrency)
		scheduleCandidatePages(groupCtx, group, client, query, first.TotalPages, func(_ int64, page vikunja.TaskPage) error {
			if !sameCandidatePagination(page, first) {
				return vikunja.ErrRejectedResponse
			}
			active.Add(countActiveTasks(page.Items, now))
			loaded.Add(int64(len(page.Items)))
			return nil
		})
		if err := group.Wait(); err != nil {
			return 0, err
		}
	}
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if loaded.Load() != first.Total {
		return 0, vikunja.ErrRejectedResponse
	}
	return int(active.Load()), nil
}

func countActiveTasks(tasks []vikunja.Task, now time.Time) int64 {
	var count int64
	for index := range tasks {
		task := &tasks[index]
		if matchesActiveWork(*task, ClassifyTask(*task), now) {
			count++
		}
	}
	return count
}
