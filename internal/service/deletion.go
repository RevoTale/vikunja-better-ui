package service

import (
	"context"
	"errors"
	"slices"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

var (
	ErrTaskNotActive     = errors.New("task is not active")
	ErrTaskNotAccessible = errors.New("task project is not accessible")
)

type taskDeletionClient interface {
	Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error)
	DeleteTask(context.Context, int64) error
}

func DeleteActiveTask(ctx context.Context, client taskDeletionClient, taskID int64, accessibleProjectIDs []int64) error {
	task, _, err := client.Task(ctx, taskID)
	if err != nil {
		return err
	}
	if task.Done || hasLabel(task.Labels, recurrenceHistoryLabel) || hasLabel(task.Labels, skippedLabel) {
		return ErrTaskNotActive
	}
	if !containsID(accessibleProjectIDs, task.ProjectID) {
		return ErrTaskNotAccessible
	}
	return client.DeleteTask(ctx, taskID)
}

func containsID(ids []int64, target int64) bool {
	return slices.Contains(ids, target)
}
