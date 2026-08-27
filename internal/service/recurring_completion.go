package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const completionMetadataPrefix = "<!-- vbu:completion-key:v1:"

type recurringCompletionClient interface {
	completionClient
	TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error)
	CreateTaskHTML(context.Context, int64, vikunja.TaskWrite) (vikunja.Task, error)
	markerClient
	AttachLabel(context.Context, int64, int64) error
}

type RecurringCompletion struct {
	LiveTask       vikunja.Task
	Snapshot       vikunja.Task
	CompletionKey  string
	RepairRequired bool
	RepairCause    error
	RepairGrant    RecurringRepairGrant
}

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
		ctx,
		client,
		capabilities,
		taskID,
		expectedDueAt,
		location,
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
		return result, nil
	}
	if found {
		result.Snapshot = existing
		return result, nil
	}
	snapshot, err := createSnapshot(ctx, client, before, key, outcome)
	if err != nil {
		result.RepairRequired = true
		result.RepairCause = err
		return result, nil
	}
	result.Snapshot = snapshot
	return result, nil
}

func normalizeRenewedDue(
	ctx context.Context,
	client recurringCompletionClient,
	task vikunja.Task,
	etag string,
	target time.Time,
) (vikunja.Task, error) {
	if task.DueDate.Equal(target) {
		return task, nil
	}
	if etag == "" {
		return vikunja.Task{}, errors.New("renewed task has no ETag")
	}
	if _, err := client.PatchTaskChecked(ctx, task.ID, vikunja.TaskPatch{DueDate: &target}, vikunja.TaskCheck{
		Done: new(false), DueDate: &task.DueDate,
		RepeatAfter: &task.RepeatAfter, RepeatMode: &task.RepeatMode,
	}); err != nil {
		return vikunja.Task{}, taskPatchError(err)
	}
	confirmed, _, err := client.Task(ctx, task.ID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if !confirmed.DueDate.Equal(target) || ClassifyTask(confirmed).Kind != TaskKindRecurring {
		return vikunja.Task{}, errors.New("fixed due time normalization was not confirmed")
	}
	return confirmed, nil
}

func normalizeRenewedJobSchedule(
	ctx context.Context,
	client recurringCompletionClient,
	task vikunja.Task,
	etag string,
	target jobSchedule,
) (vikunja.Task, error) {
	if jobScheduleMatches(task, target) {
		return task, nil
	}
	if etag == "" {
		return vikunja.Task{}, errors.New("renewed task has no ETag")
	}
	if _, err := client.PatchTaskChecked(ctx, task.ID, vikunja.TaskPatch{
		StartDate: &target.StartAt, EndDate: &target.EndAt, DueDate: &target.DueAt,
	}, vikunja.TaskCheck{
		Done: new(false), StartDate: &task.StartDate, EndDate: &task.EndDate, DueDate: &task.DueDate,
		RepeatAfter: &task.RepeatAfter, RepeatMode: &task.RepeatMode,
	}); err != nil {
		return vikunja.Task{}, taskPatchError(err)
	}
	confirmed, _, err := client.Task(ctx, task.ID)
	if err != nil {
		return vikunja.Task{}, err
	}
	classification := ClassifyTask(confirmed)
	if !jobScheduleMatches(confirmed, target) ||
		classification.Kind != TaskKindJob || !classification.Recurring {
		return vikunja.Task{}, errors.New("recurring job schedule normalization was not confirmed")
	}
	return confirmed, nil
}

func jobScheduleMatches(task vikunja.Task, target jobSchedule) bool {
	return task.StartDate.Equal(target.StartAt) && task.EndDate.Equal(target.EndAt) &&
		task.DueDate.Equal(target.DueAt)
}

func verifyRenewal(before vikunja.Task, renewed vikunja.Task) error {
	if renewed.ID != before.ID || renewed.Done || renewed.DoneAt.IsZero() || renewed.DueDate.IsZero() ||
		!ClassifyTask(renewed).Recurring {
		return errors.New("recurring renewal could not be confirmed")
	}
	switch before.RepeatMode {
	case 0:
		if !renewed.DueDate.After(before.DueDate) {
			return errors.New("recurring due date did not advance")
		}
		step := time.Duration(before.RepeatAfter) * time.Second
		if step <= 0 {
			return errors.New("scheduled recurrence interval is invalid")
		}
		expected, err := advanceAfter(before.DueDate.Add(step), renewed.DoneAt, step)
		if err != nil {
			return err
		}
		if !renewed.DueDate.Equal(expected) {
			return errors.New("scheduled recurrence advanced unexpectedly")
		}
	case 1:
		if !renewed.DueDate.After(before.DueDate) {
			return errors.New("recurring due date did not advance")
		}
		expected := time.Date(
			before.DueDate.Year(), before.DueDate.Month()+1, before.DueDate.Day(),
			before.DueDate.Hour(), before.DueDate.Minute(), before.DueDate.Second(), before.DueDate.Nanosecond(),
			before.DueDate.Location(),
		)
		if !renewed.DueDate.Equal(expected) {
			return errors.New("monthly recurrence advanced unexpectedly")
		}
	case 2:
		expected := renewed.DoneAt.Add(time.Duration(before.RepeatAfter) * time.Second)
		if absoluteDuration(renewed.DueDate.Sub(expected)) > 2*time.Second {
			return errors.New("from-completion recurrence advanced unexpectedly")
		}
	default:
		return errors.New("recurrence mode is unsupported")
	}
	return nil
}

func normalizeRenewedDateOnly(
	ctx context.Context,
	client recurringCompletionClient,
	task vikunja.Task,
	etag string,
	location *time.Location,
) (vikunja.Task, error) {
	if !ClassifyTask(task).DateOnly {
		return task, nil
	}
	localDue := task.DueDate.In(location)
	normalized := time.Date(localDue.Year(), localDue.Month(), localDue.Day(), 23, 59, 59, 0, location)
	if task.DueDate.Equal(normalized) {
		return task, nil
	}
	if etag == "" {
		return vikunja.Task{}, errors.New("renewed task has no ETag")
	}
	if _, err := client.PatchTaskChecked(ctx, task.ID, vikunja.TaskPatch{DueDate: &normalized}, vikunja.TaskCheck{
		Done: new(false), DueDate: &task.DueDate,
	}); err != nil {
		return vikunja.Task{}, taskPatchError(err)
	}
	confirmed, _, err := client.Task(ctx, task.ID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if !confirmed.DueDate.Equal(normalized) || !ClassifyTask(confirmed).DateOnly {
		return vikunja.Task{}, errors.New("date-only renewal normalization was not confirmed")
	}
	return confirmed, nil
}

func findSnapshot(
	ctx context.Context,
	client recurringCompletionClient,
	projectID int64,
	key string,
	outcome CompletionOutcome,
) (vikunja.Task, bool, error) {
	task, found, err := findSnapshotCandidate(ctx, client, projectID, key)
	if err != nil || !found {
		return task, found, err
	}
	if !snapshotMatchesOutcome(task, outcome) {
		return vikunja.Task{}, false, errors.New("completion key belongs to an invalid snapshot")
	}
	return task, true, nil
}

func findSnapshotCandidate(
	ctx context.Context,
	client recurringCompletionClient,
	projectID int64,
	key string,
) (vikunja.Task, bool, error) {
	page, err := client.TasksPage(ctx, vikunja.TaskQuery{Page: 1, PerPage: 1000, Search: key})
	if err != nil {
		return vikunja.Task{}, false, err
	}
	var matching []vikunja.Task
	metadata := completionMetadata(key)
	for _, task := range page.Items {
		if task.ProjectID == projectID && strings.Contains(task.Description, metadata) {
			matching = append(matching, task)
		}
	}
	if len(matching) > 1 {
		return vikunja.Task{}, false, errors.New("multiple recurring snapshots use one completion key")
	}
	if len(matching) == 0 {
		return vikunja.Task{}, false, nil
	}
	return matching[0], true, nil
}

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
	if !grant.TargetStartAt.IsZero() && repairScheduleMatches(live, grant, false) {
		live, err = normalizeRenewedJobSchedule(ctx, client, live, metadata.ETag, jobSchedule{
			StartAt: grant.TargetStartAt, EndAt: grant.TargetEndAt, DueAt: grant.TargetDueAt,
		})
		if err != nil {
			return RecurringCompletion{}, err
		}
	} else if grant.TargetStartAt.IsZero() && !grant.TargetDueAt.IsZero() && live.DueDate.Equal(grant.NativeDueAt) {
		live, err = normalizeRenewedDue(ctx, client, live, metadata.ETag, grant.TargetDueAt)
		if err != nil {
			return RecurringCompletion{}, err
		}
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

func attachMissingSnapshotLabels(
	ctx context.Context,
	client recurringCompletionClient,
	liveLabels []vikunja.Label,
	snapshot *vikunja.Task,
	outcome CompletionOutcome,
) error {
	for _, label := range liveLabels {
		if !snapshotLabelAllowed(label.Title) || hasLabelID(snapshot.Labels, label.ID) {
			continue
		}
		if err := client.AttachLabel(ctx, snapshot.ID, label.ID); err != nil {
			return err
		}
		snapshot.Labels = append(snapshot.Labels, label)
	}
	if !hasLabel(snapshot.Labels, recurrenceHistoryLabel) {
		historyMarker, err := ResolveMarker(ctx, client, recurrenceHistoryLabel)
		if err != nil {
			return err
		}
		if err := client.AttachLabel(ctx, snapshot.ID, historyMarker.ID); err != nil {
			return err
		}
		snapshot.Labels = append(snapshot.Labels, historyMarker)
	}
	if outcome != CompletionOutcomeSkipped || hasLabel(snapshot.Labels, skippedLabel) {
		return nil
	}
	skippedMarker, err := ResolveMarker(ctx, client, skippedLabel)
	if err != nil {
		return err
	}
	if err := client.AttachLabel(ctx, snapshot.ID, skippedMarker.ID); err != nil {
		return err
	}
	snapshot.Labels = append(snapshot.Labels, skippedMarker)
	return nil
}

func hasLabelID(labels []vikunja.Label, id int64) bool {
	for _, label := range labels {
		if label.ID == id {
			return true
		}
	}
	return false
}

func createSnapshot(
	ctx context.Context,
	client recurringCompletionClient,
	before vikunja.Task,
	key string,
	outcome CompletionOutcome,
) (vikunja.Task, error) {
	historyMarker, err := ResolveMarker(ctx, client, recurrenceHistoryLabel)
	if err != nil {
		return vikunja.Task{}, err
	}
	var skippedMarker vikunja.Label
	if outcome == CompletionOutcomeSkipped {
		skippedMarker, err = ResolveMarker(ctx, client, skippedLabel)
		if err != nil {
			return vikunja.Task{}, err
		}
	}
	input := vikunja.TaskWrite{
		Title: before.Title, Description: appendCompletionMetadata(before.Description, key),
		DueDate: optionalWriteTime(before.DueDate), Priority: before.Priority,
		StartDate: optionalWriteTime(before.StartDate), EndDate: optionalWriteTime(before.EndDate),
	}
	created, err := client.CreateTaskHTML(ctx, before.ProjectID, input)
	if err != nil {
		return vikunja.Task{}, err
	}
	if created.ID <= 0 || created.Done || created.RepeatAfter != 0 || created.RepeatMode != 0 {
		return vikunja.Task{}, vikunja.ErrRejectedResponse
	}
	for _, label := range before.Labels {
		if !snapshotLabelAllowed(label.Title) {
			continue
		}
		if err := client.AttachLabel(ctx, created.ID, label.ID); err != nil {
			return vikunja.Task{}, err
		}
		created.Labels = append(created.Labels, label)
	}
	if err := client.AttachLabel(ctx, created.ID, historyMarker.ID); err != nil {
		return vikunja.Task{}, err
	}
	created.Labels = append(created.Labels, historyMarker)
	if outcome == CompletionOutcomeSkipped {
		if err := client.AttachLabel(ctx, created.ID, skippedMarker.ID); err != nil {
			return vikunja.Task{}, err
		}
		created.Labels = append(created.Labels, skippedMarker)
	}
	return finalizeSnapshot(ctx, client, created.ID, key, outcome)
}

func snapshotLabelAllowed(title string) bool {
	return title != recurrenceHistoryLabel && title != skippedLabel && title != fixedDueTimeLabel
}

func finalizeSnapshot(
	ctx context.Context,
	client recurringCompletionClient,
	taskID int64,
	key string,
	outcome CompletionOutcome,
) (vikunja.Task, error) {
	task, metadata, err := client.Task(ctx, taskID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if task.RepeatAfter != 0 || task.RepeatMode != 0 ||
		!strings.Contains(task.Description, completionMetadata(key)) {
		return vikunja.Task{}, vikunja.ErrRejectedResponse
	}
	if !task.Done {
		done := true
		if metadata.ETag == "" {
			return vikunja.Task{}, vikunja.ErrRejectedResponse
		}
		if _, err := client.PatchTaskChecked(ctx, taskID, vikunja.TaskPatch{Done: &done}, vikunja.TaskCheck{
			Done: new(false), RepeatAfter: &task.RepeatAfter, RepeatMode: &task.RepeatMode,
		}); err != nil {
			return vikunja.Task{}, taskPatchError(err)
		}
		task, _, err = client.Task(ctx, taskID)
		if err != nil {
			return vikunja.Task{}, err
		}
	}
	if !snapshotMatchesOutcome(task, outcome) || !strings.Contains(task.Description, completionMetadata(key)) {
		return vikunja.Task{}, vikunja.ErrRejectedResponse
	}
	return task, nil
}

func validSnapshot(task vikunja.Task) bool {
	return task.Done && !task.DoneAt.IsZero() && task.RepeatAfter == 0 && task.RepeatMode == 0 &&
		hasLabel(task.Labels, recurrenceHistoryLabel)
}

func snapshotMatchesOutcome(task vikunja.Task, outcome CompletionOutcome) bool {
	return validSnapshot(task) && ClassifyTask(task).Outcome == outcome
}

func appendCompletionMetadata(description string, key string) string {
	if description == "" {
		return completionMetadata(key)
	}
	return strings.TrimRight(description, "\n") + "\n\n" + completionMetadata(key)
}

func completionMetadata(key string) string {
	return completionMetadataPrefix + key + " -->"
}

func optionalWriteTime(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	copy := value
	return &copy
}

func absoluteDuration(value time.Duration) time.Duration {
	if value < 0 {
		return -value
	}
	return value
}
