package service

import (
	"context"
	"fmt"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type recurringCompletionClient interface {
	completionClient
	snapshotRelationClient
	TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error)
	CreateTaskHTML(context.Context, int64, vikunja.TaskWrite) (vikunja.Task, error)
	markerClient
	AttachLabel(context.Context, int64, int64) error
}

// RecurringCompletion preserves the renewed task and any recoverable snapshot/normalization failure.
type RecurringCompletion struct {
	LiveTask       vikunja.Task
	Snapshot       vikunja.Task
	CompletionKey  string
	RepairRequired bool
	RepairCause    error
	RepairGrant    RecurringRepairGrant
}

// CompleteRecurring renews the native series and records the finished occurrence once.
func CompleteRecurring(
	ctx context.Context,
	client recurringCompletionClient,
	capabilities *CapabilityManager,
	taskID int64,
	expectedDueAt time.Time,
	location *time.Location,
) (RecurringCompletion, error) {
	return completeRecurring(ctx, client, capabilities, taskID, expectedDueAt, location, CompletionOutcomeCompleted)
}

// SkipRecurring renews the series with a distinct skipped history outcome and no Undo.
func SkipRecurring(
	ctx context.Context,
	client recurringCompletionClient,
	capabilities *CapabilityManager,
	taskID int64,
	expectedDueAt time.Time,
	location *time.Location,
) (RecurringCompletion, error) {
	return completeRecurring(ctx, client, capabilities, taskID, expectedDueAt, location, CompletionOutcomeSkipped)
}

func completeRecurring(
	ctx context.Context,
	client recurringCompletionClient,
	capabilities *CapabilityManager,
	taskID int64,
	expectedDueAt time.Time,
	location *time.Location,
	outcome CompletionOutcome,
) (RecurringCompletion, error) {
	before, fixedTarget, err := prepareRecurringCompletion(
		ctx, client, capabilities, taskID, expectedDueAt, location,
	)
	if err != nil {
		return RecurringCompletion{}, err
	}

	renewed, renewedMetadata, key, repairGrant, err := renewRecurringTask(
		ctx, client, capabilities, before, fixedTarget, outcome,
	)
	if err != nil {
		return RecurringCompletion{}, err
	}
	if ClassifyTask(before).Kind == TaskKindJob {
		normalized, updatedGrant, normalizeErr := normalizeRecurringJob(
			ctx, client, before, renewed, renewedMetadata.ETag, location, repairGrant,
		)
		repairGrant = updatedGrant
		if normalizeErr != nil {
			//nolint:nilerr // Renewal succeeded; expose normalization failure through RepairCause.
			return RecurringCompletion{
				LiveTask: renewed, CompletionKey: key, RepairRequired: true,
				RepairCause: normalizeErr, RepairGrant: repairGrant,
			}, nil
		}
		renewed = normalized
	} else if !fixedTarget.IsZero() {
		normalized, normalizeErr := normalizeRenewedDue(ctx, client, renewed, renewedMetadata.ETag, fixedTarget)
		err = normalizeErr
		if err != nil {
			//nolint:nilerr // Renewal succeeded; expose normalization failure through RepairCause.
			return RecurringCompletion{
				LiveTask: renewed, CompletionKey: key, RepairRequired: true,
				RepairCause: err, RepairGrant: repairGrant,
			}, nil
		}
		renewed = normalized
	}
	_, err = normalizeRenewedDateOnly(ctx, client, renewed, renewedMetadata.ETag, location)
	if err != nil {
		return RecurringCompletion{}, err
	}
	renewed, finalMetadata, err := client.Task(ctx, taskID)
	if err != nil || finalMetadata.ETag == "" {
		return RecurringCompletion{}, fmt.Errorf("read final renewed task: %w", err)
	}

	repairGrant.LiveETag = finalMetadata.ETag
	return completeRecurringSnapshot(ctx, client, before, renewed, key, repairGrant, outcome)
}

func normalizeRecurringJob(
	ctx context.Context,
	client recurringCompletionClient,
	before vikunja.Task,
	renewed vikunja.Task,
	etag string,
	location *time.Location,
	grant RecurringRepairGrant,
) (vikunja.Task, RecurringRepairGrant, error) {
	target, err := targetRecurringJobSchedule(before, renewed.DoneAt, location)
	if err != nil {
		return renewed, grant, err
	}
	grant.TargetStartAt = target.StartAt
	grant.TargetEndAt = target.EndAt
	grant.TargetDueAt = target.DueAt
	normalized, err := normalizeRenewedJobSchedule(ctx, client, renewed, etag, target)
	return normalized, grant, err
}

func prepareRecurringCompletion(
	ctx context.Context,
	client recurringCompletionClient,
	capabilities *CapabilityManager,
	taskID int64,
	expectedDueAt time.Time,
	location *time.Location,
) (vikunja.Task, time.Time, error) {
	task, metadata, err := client.Task(ctx, taskID)
	if err != nil {
		return vikunja.Task{}, time.Time{}, err
	}
	classification := ClassifyTask(task)
	if task.Done || metadata.ETag == "" || !classification.Recurring {
		return vikunja.Task{}, time.Time{}, ErrTaskKindMismatch
	}
	if expectedDueAt.IsZero() || !task.DueDate.Equal(expectedDueAt) {
		return vikunja.Task{}, time.Time{}, ErrTaskStateChanged
	}
	if !classification.FixedDueTime {
		return task, time.Time{}, nil
	}
	if classification.Kind == TaskKindJob {
		_, err := targetRecurringJobSchedule(task, capabilities.now(), location)
		return task, time.Time{}, err
	}
	fixedTarget, err := resolveCompletionDateDueTime(
		capabilities.now(), task.DueDate, task.RepeatAfter, location,
	)
	return task, fixedTarget, err
}

func renewRecurringTask(
	ctx context.Context,
	client recurringCompletionClient,
	capabilities *CapabilityManager,
	before vikunja.Task,
	fixedTarget time.Time,
	outcome CompletionOutcome,
) (vikunja.Task, vikunja.ResponseMetadata, string, RecurringRepairGrant, error) {
	done := true
	if _, err := client.PatchTaskChecked(ctx, before.ID, vikunja.TaskPatch{Done: &done}, vikunja.TaskCheck{
		Done: new(false), DueDate: &before.DueDate,
		RepeatAfter: &before.RepeatAfter, RepeatMode: &before.RepeatMode,
	}); err != nil {
		return vikunja.Task{}, vikunja.ResponseMetadata{}, "", RecurringRepairGrant{}, taskPatchError(err)
	}
	renewed, metadata, err := client.Task(ctx, before.ID)
	if err != nil {
		return vikunja.Task{}, vikunja.ResponseMetadata{}, "", RecurringRepairGrant{}, err
	}
	if err := verifyRenewal(before, renewed); err != nil {
		return vikunja.Task{}, vikunja.ResponseMetadata{}, "", RecurringRepairGrant{}, err
	}
	key := capabilities.CompletionKey(before.ID, renewed.DoneAt, before.DueDate)
	grant := RecurringRepairGrant{
		TaskID: before.ID, ProjectID: before.ProjectID, LiveETag: metadata.ETag, CompletionKey: key,
		Outcome: outcome, DueAt: before.DueDate, StartAt: before.StartDate, EndAt: before.EndDate,
		RenewedDoneAt: renewed.DoneAt,
		NativeStartAt: renewed.StartDate, NativeEndAt: renewed.EndDate,
		NativeDueAt: renewed.DueDate, TargetDueAt: fixedTarget,
		RepeatAfter: renewed.RepeatAfter, RepeatMode: renewed.RepeatMode,
	}
	return renewed, metadata, key, grant, nil
}

func completeRecurringSnapshot(
	ctx context.Context,
	client recurringCompletionClient,
	before vikunja.Task,
	renewed vikunja.Task,
	key string,
	repairGrant RecurringRepairGrant,
	outcome CompletionOutcome,
) (RecurringCompletion, error) {
	result := RecurringCompletion{LiveTask: renewed, CompletionKey: key, RepairGrant: repairGrant}
	existing, found, err := findSnapshot(ctx, client, before.ProjectID, key, outcome)
	if err != nil {
		result.RepairRequired = true
		result.RepairCause = err
		return result, nil //nolint:nilerr // Renewal succeeded; expose snapshot failure through RepairCause.
	}
	if found {
		result.Snapshot = existing
		return result, nil
	}
	snapshot, err := createSnapshot(ctx, client, before, key, outcome)
	if err != nil {
		result.RepairRequired = true
		result.RepairCause = err
		return result, nil //nolint:nilerr // Renewal succeeded; expose snapshot failure through RepairCause.
	}
	result.Snapshot = snapshot
	return result, nil
}
