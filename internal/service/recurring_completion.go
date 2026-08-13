package service

import (
	"context"
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
	location *time.Location,
) (RecurringCompletion, error) {
	before, metadata, err := client.Task(ctx, taskID)
	if err != nil {
		return RecurringCompletion{}, err
	}
	if before.Done || metadata.ETag == "" || ClassifyTask(before).Kind != TaskKindRecurring {
		return RecurringCompletion{}, ErrTaskKindMismatch
	}

	done := true
	if _, err := client.PatchTaskChecked(ctx, taskID, vikunja.TaskPatch{Done: &done}, vikunja.TaskCheck{
		Done: boolValue(false), DueDate: &before.DueDate,
		RepeatAfter: &before.RepeatAfter, RepeatMode: &before.RepeatMode,
	}); err != nil {
		return RecurringCompletion{}, taskPatchError(err)
	}
	renewed, renewedMetadata, err := client.Task(ctx, taskID)
	if err != nil {
		return RecurringCompletion{}, err
	}
	if err := verifyRenewal(before, renewed); err != nil {
		return RecurringCompletion{}, err
	}
	_, err = normalizeRenewedDateOnly(ctx, client, renewed, renewedMetadata.ETag, location)
	if err != nil {
		return RecurringCompletion{}, err
	}
	renewed, finalMetadata, err := client.Task(ctx, taskID)
	if err != nil || finalMetadata.ETag == "" {
		return RecurringCompletion{}, fmt.Errorf("read final renewed task: %w", err)
	}

	key := capabilities.CompletionKey(taskID, renewed.DoneAt)
	baseResult := RecurringCompletion{
		LiveTask: renewed, CompletionKey: key,
		RepairGrant: RecurringRepairGrant{
			TaskID: taskID, ProjectID: before.ProjectID, LiveETag: finalMetadata.ETag, CompletionKey: key,
			DueAt: before.DueDate, StartAt: before.StartDate, EndAt: before.EndDate,
		},
	}
	if existing, found, err := findSnapshot(ctx, client, before.ProjectID, key); err != nil {
		baseResult.RepairRequired = true
		baseResult.RepairCause = err
		return baseResult, nil
	} else if found {
		baseResult.Snapshot = existing
		return baseResult, nil
	}

	snapshot, err := createSnapshot(ctx, client, before, key)
	if err != nil {
		baseResult.RepairRequired = true
		baseResult.RepairCause = err
		return baseResult, nil
	}
	baseResult.Snapshot = snapshot
	return baseResult, nil
}

func verifyRenewal(before vikunja.Task, renewed vikunja.Task) error {
	if renewed.ID != before.ID || renewed.Done || renewed.DoneAt.IsZero() || renewed.DueDate.IsZero() ||
		ClassifyTask(renewed).Kind != TaskKindRecurring {
		return fmt.Errorf("recurring renewal could not be confirmed")
	}
	if !renewed.DueDate.After(before.DueDate) {
		return fmt.Errorf("recurring due date did not advance")
	}
	switch before.RepeatMode {
	case 0:
		step := time.Duration(before.RepeatAfter) * time.Second
		if step <= 0 {
			return fmt.Errorf("scheduled recurrence interval is invalid")
		}
		expected := before.DueDate.Add(step)
		for !expected.After(renewed.DoneAt) {
			expected = expected.Add(step)
		}
		if !renewed.DueDate.Equal(expected) {
			return fmt.Errorf("scheduled recurrence advanced unexpectedly")
		}
	case 1:
		expected := time.Date(
			before.DueDate.Year(), before.DueDate.Month()+1, before.DueDate.Day(),
			before.DueDate.Hour(), before.DueDate.Minute(), before.DueDate.Second(), before.DueDate.Nanosecond(),
			before.DueDate.Location(),
		)
		if !renewed.DueDate.Equal(expected) {
			return fmt.Errorf("monthly recurrence advanced unexpectedly")
		}
	case 2:
		expected := renewed.DoneAt.Add(time.Duration(before.RepeatAfter) * time.Second)
		if absoluteDuration(renewed.DueDate.Sub(expected)) > 2*time.Second {
			return fmt.Errorf("from-completion recurrence advanced unexpectedly")
		}
	default:
		return fmt.Errorf("recurrence mode is unsupported")
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
		return vikunja.Task{}, fmt.Errorf("renewed task has no ETag")
	}
	if _, err := client.PatchTaskChecked(ctx, task.ID, vikunja.TaskPatch{DueDate: &normalized}, vikunja.TaskCheck{
		Done: boolValue(false), DueDate: &task.DueDate,
	}); err != nil {
		return vikunja.Task{}, taskPatchError(err)
	}
	confirmed, _, err := client.Task(ctx, task.ID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if !confirmed.DueDate.Equal(normalized) || !ClassifyTask(confirmed).DateOnly {
		return vikunja.Task{}, fmt.Errorf("date-only renewal normalization was not confirmed")
	}
	return confirmed, nil
}

func findSnapshot(
	ctx context.Context,
	client recurringCompletionClient,
	projectID int64,
	key string,
) (vikunja.Task, bool, error) {
	task, found, err := findSnapshotCandidate(ctx, client, projectID, key)
	if err != nil || !found {
		return task, found, err
	}
	if !validSnapshot(task) {
		return vikunja.Task{}, false, fmt.Errorf("completion key belongs to an invalid snapshot")
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
		return vikunja.Task{}, false, fmt.Errorf("multiple recurring snapshots use one completion key")
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
	if metadata.ETag != grant.LiveETag || live.Done || ClassifyTask(live).Kind != TaskKindRecurring {
		return RecurringCompletion{}, ErrTaskStateChanged
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
		candidate, err = createSnapshot(ctx, client, before, grant.CompletionKey)
		if err != nil {
			return RecurringCompletion{}, err
		}
		return RecurringCompletion{LiveTask: live, Snapshot: candidate, CompletionKey: grant.CompletionKey}, nil
	}
	if candidate.RepeatAfter != 0 || candidate.RepeatMode != 0 {
		return RecurringCompletion{}, fmt.Errorf("completion key belongs to a non-snapshot task")
	}
	if err := attachMissingSnapshotLabels(ctx, client, live.Labels, &candidate); err != nil {
		return RecurringCompletion{}, err
	}
	confirmed, err := finalizeSnapshot(ctx, client, candidate.ID, grant.CompletionKey)
	if err != nil {
		return RecurringCompletion{}, err
	}
	if !validSnapshot(confirmed) || !strings.Contains(confirmed.Description, completionMetadata(grant.CompletionKey)) {
		return RecurringCompletion{}, vikunja.ErrRejectedResponse
	}
	return RecurringCompletion{LiveTask: live, Snapshot: confirmed, CompletionKey: grant.CompletionKey}, nil
}

func attachMissingSnapshotLabels(
	ctx context.Context,
	client recurringCompletionClient,
	liveLabels []vikunja.Label,
	snapshot *vikunja.Task,
) error {
	for _, label := range liveLabels {
		if label.Title == recurrenceHistoryLabel || hasLabelID(snapshot.Labels, label.ID) {
			continue
		}
		if err := client.AttachLabel(ctx, snapshot.ID, label.ID); err != nil {
			return err
		}
		snapshot.Labels = append(snapshot.Labels, label)
	}
	if hasLabel(snapshot.Labels, recurrenceHistoryLabel) {
		return nil
	}
	historyMarker, err := ResolveMarker(ctx, client, recurrenceHistoryLabel)
	if err != nil {
		return err
	}
	if err := client.AttachLabel(ctx, snapshot.ID, historyMarker.ID); err != nil {
		return err
	}
	snapshot.Labels = append(snapshot.Labels, historyMarker)
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
) (vikunja.Task, error) {
	historyMarker, err := ResolveMarker(ctx, client, recurrenceHistoryLabel)
	if err != nil {
		return vikunja.Task{}, err
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
		if label.Title == recurrenceHistoryLabel {
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
	return finalizeSnapshot(ctx, client, created.ID, key)
}

func finalizeSnapshot(
	ctx context.Context,
	client recurringCompletionClient,
	taskID int64,
	key string,
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
			Done: boolValue(false), RepeatAfter: &task.RepeatAfter, RepeatMode: &task.RepeatMode,
		}); err != nil {
			return vikunja.Task{}, taskPatchError(err)
		}
		task, _, err = client.Task(ctx, taskID)
		if err != nil {
			return vikunja.Task{}, err
		}
	}
	if !validSnapshot(task) || !strings.Contains(task.Description, completionMetadata(key)) {
		return vikunja.Task{}, vikunja.ErrRejectedResponse
	}
	return task, nil
}

func validSnapshot(task vikunja.Task) bool {
	return task.Done && !task.DoneAt.IsZero() && task.RepeatAfter == 0 && task.RepeatMode == 0 &&
		hasLabel(task.Labels, recurrenceHistoryLabel)
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
