package service

import (
	"context"
	"errors"
	"strings"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// RepairRecurringSnapshot reconciles the authorized renewal without completing the series again.
func RepairRecurringSnapshot(
	ctx context.Context,
	client recurringCompletionClient,
	grant RecurringRepairGrant,
) (RecurringCompletion, error) {
	live, metadata, err := client.Task(ctx, grant.TaskID)
	if err != nil {
		return RecurringCompletion{}, err
	}
	if !repairLiveStateMatches(live, metadata.ETag, grant) {
		return RecurringCompletion{}, ErrTaskStateChanged
	}
	live, err = repairRenewedSchedule(ctx, client, live, metadata.ETag, grant)
	if err != nil {
		return RecurringCompletion{}, err
	}
	candidate, found, err := findSnapshotCandidate(ctx, client, grant.ProjectID, grant.CompletionKey)
	if err != nil {
		return RecurringCompletion{}, err
	}
	if !found {
		before := live
		before.DueDate = grant.DueAt
		before.StartDate = grant.StartAt
		before.EndDate = grant.EndAt
		candidate, err = createSnapshot(ctx, client, before, grant.CompletionKey, grant.Outcome)
		if err != nil {
			return RecurringCompletion{}, err
		}
		return RecurringCompletion{LiveTask: live, Snapshot: candidate, CompletionKey: grant.CompletionKey}, nil
	}
	if candidate.RepeatAfter != 0 || candidate.RepeatMode != 0 {
		return RecurringCompletion{}, errors.New("completion key belongs to a non-snapshot task")
	}
	if grant.Outcome == CompletionOutcomeCompleted && hasLabel(candidate.Labels, skippedLabel) {
		return RecurringCompletion{}, errors.New("completion key belongs to a skipped snapshot")
	}
	if err := attachMissingSnapshotLabels(ctx, client, live.Labels, &candidate, grant.Outcome); err != nil {
		return RecurringCompletion{}, err
	}
	confirmed, err := finalizeSnapshot(ctx, client, candidate.ID, grant.CompletionKey, grant.Outcome)
	if err != nil {
		return RecurringCompletion{}, err
	}
	if !snapshotMatchesOutcome(confirmed, grant.Outcome) ||
		!strings.Contains(confirmed.Description, completionMetadata(grant.CompletionKey)) {
		return RecurringCompletion{}, vikunja.ErrRejectedResponse
	}
	return RecurringCompletion{LiveTask: live, Snapshot: confirmed, CompletionKey: grant.CompletionKey}, nil
}

func repairRenewedSchedule(
	ctx context.Context, client recurringCompletionClient, live vikunja.Task, etag string, grant RecurringRepairGrant,
) (vikunja.Task, error) {
	if !grant.TargetStartAt.IsZero() && repairScheduleMatches(live, grant, false) {
		return normalizeRenewedJobSchedule(ctx, client, live, etag, jobSchedule{
			StartAt: grant.TargetStartAt, EndAt: grant.TargetEndAt, DueAt: grant.TargetDueAt,
		})
	}
	if grant.TargetStartAt.IsZero() && !grant.TargetDueAt.IsZero() && live.DueDate.Equal(grant.NativeDueAt) {
		return normalizeRenewedDue(ctx, client, live, etag, grant.TargetDueAt)
	}
	return live, nil
}

func repairLiveStateMatches(live vikunja.Task, etag string, grant RecurringRepairGrant) bool {
	if live.Done || !ClassifyTask(live).Recurring {
		return false
	}
	if grant.RenewedDoneAt.IsZero() {
		return etag == grant.LiveETag
	}
	allowedSchedule := repairScheduleMatches(live, grant, false) || repairScheduleMatches(live, grant, true)
	return live.DoneAt.Equal(grant.RenewedDoneAt) && live.RepeatAfter == grant.RepeatAfter &&
		live.RepeatMode == grant.RepeatMode && allowedSchedule
}

func repairScheduleMatches(task vikunja.Task, grant RecurringRepairGrant, target bool) bool {
	start, end, due := grant.NativeStartAt, grant.NativeEndAt, grant.NativeDueAt
	if target {
		start, end, due = grant.TargetStartAt, grant.TargetEndAt, grant.TargetDueAt
	}
	if start.IsZero() && end.IsZero() {
		return task.DueDate.Equal(due)
	}
	return jobScheduleMatches(task, jobSchedule{StartAt: start, EndAt: end, DueAt: due})
}
