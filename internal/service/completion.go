package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

var (
	ErrTaskKindMismatch  = errors.New("task kind no longer matches the requested action")
	ErrTaskStateChanged  = errors.New("task changed since the action was authorized")
	ErrTaskNotActionable = errors.New("task cannot be completed in its current state")
)

type completionClient interface {
	Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error)
	PatchTaskChecked(context.Context, int64, vikunja.TaskPatch, vikunja.TaskCheck) (vikunja.Task, error)
}

type NonRecurringCompletion struct {
	Task           vikunja.Task
	UndoCapability string
	UndoUntil      time.Time
}

func CompleteNonRecurring(
	ctx context.Context,
	client completionClient,
	capabilities *CapabilityManager,
	sessionID string,
	taskID int64,
	expectedKind TaskKind,
) (NonRecurringCompletion, error) {
	if expectedKind != TaskKindOneTime && expectedKind != TaskKindJob {
		return NonRecurringCompletion{}, ErrTaskKindMismatch
	}
	task, metadata, err := client.Task(ctx, taskID)
	if err != nil {
		return NonRecurringCompletion{}, err
	}
	if task.Done || metadata.ETag == "" {
		return NonRecurringCompletion{}, ErrTaskNotActionable
	}
	if ClassifyTask(task).Kind != expectedKind {
		return NonRecurringCompletion{}, ErrTaskKindMismatch
	}

	done := true
	if _, err := client.PatchTaskChecked(ctx, taskID, vikunja.TaskPatch{Done: &done}, vikunja.TaskCheck{Done: new(false)}); err != nil {
		return NonRecurringCompletion{}, taskPatchError(err)
	}
	completed, completedMetadata, err := client.Task(ctx, taskID)
	if err != nil {
		return NonRecurringCompletion{}, err
	}
	if !completed.Done || completed.DoneAt.IsZero() || completedMetadata.ETag == "" ||
		ClassifyTask(completed).Kind != expectedKind {
		return NonRecurringCompletion{}, vikunja.ErrRejectedResponse
	}

	capability, undoUntil, err := capabilities.IssueUndo(sessionID, UndoGrant{
		TaskID: taskID, Kind: expectedKind, DoneAt: completed.DoneAt, ETag: completedMetadata.ETag,
	})
	if err != nil {
		return NonRecurringCompletion{}, fmt.Errorf("issue undo capability: %w", err)
	}
	return NonRecurringCompletion{Task: completed, UndoCapability: capability, UndoUntil: undoUntil}, nil
}

func UndoNonRecurring(
	ctx context.Context,
	client completionClient,
	capabilities *CapabilityManager,
	sessionID string,
	capability string,
) (vikunja.Task, error) {
	grant, err := capabilities.ParseUndo(sessionID, capability)
	if err != nil {
		return vikunja.Task{}, err
	}
	task, metadata, err := client.Task(ctx, grant.TaskID)
	if err != nil {
		return vikunja.Task{}, err
	}
	classification := ClassifyTask(task)
	if metadata.ETag != grant.ETag || !task.Done || !task.DoneAt.Equal(grant.DoneAt) || classification.Kind != grant.Kind {
		return vikunja.Task{}, ErrTaskStateChanged
	}

	done := false
	if _, err := client.PatchTaskChecked(ctx, task.ID, vikunja.TaskPatch{Done: &done}, vikunja.TaskCheck{
		Done: new(true), DoneAt: &task.DoneAt,
	}); err != nil {
		return vikunja.Task{}, taskPatchError(err)
	}
	reopened, _, err := client.Task(ctx, task.ID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if reopened.Done || !reopened.DoneAt.IsZero() || ClassifyTask(reopened).Kind != grant.Kind {
		return vikunja.Task{}, vikunja.ErrRejectedResponse
	}
	return reopened, nil
}

func taskPatchError(err error) error {
	if errors.Is(err, vikunja.ErrConditionFailed) {
		return ErrTaskStateChanged
	}
	return err
}
