package service

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type relationSearchClient interface {
	relationTaskReader
	TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error)
}

const relationSearchPageSize = 20

// FindRelationCandidates reads a bounded accessible page, never scanning all tasks.
func FindRelationCandidates(
	ctx context.Context, client relationSearchClient, taskID int64, search string, page int64,
) (vikunja.TaskPage, error) {
	search = strings.TrimSpace(search)
	if taskID <= 0 || page < 1 || len(search) > 250 {
		return vikunja.TaskPage{}, errors.New("invalid relation search")
	}
	var result vikunja.TaskPage
	if id, err := strconv.ParseInt(strings.TrimPrefix(search, "#"), 10, 64); err == nil && id > 0 {
		task, _, readErr := client.Task(ctx, id)
		if readErr != nil {
			return result, readErr
		}
		result = vikunja.TaskPage{
			Items: []vikunja.Task{task}, Page: 1, PerPage: relationSearchPageSize, Total: 1, TotalPages: 1,
		}
	} else {
		var readErr error
		result, readErr = client.TasksPage(ctx, vikunja.TaskQuery{
			Page: page, PerPage: relationSearchPageSize, Search: search,
			SortBy: []string{"created"}, OrderBy: []string{"desc"},
		})
		if readErr != nil {
			return result, readErr
		}
	}
	items := make([]vikunja.Task, 0, len(result.Items))
	for _, task := range result.Items {
		if task.ID != taskID && !hasLabel(task.Labels, recurrenceHistoryLabel) {
			items = append(items, task)
		}
	}
	result.Items = items
	return result, nil
}
