package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const completionMetadataPrefix = "<!-- vbu:completion-key:v1:"

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
	page, err := client.TasksPage(ctx, vikunja.TaskQuery{Page: 1, PerPage: upstreamTaskPageSize, Search: key})
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
	return finalizeRelatedSnapshot(ctx, client, before.ID, created.ID, key, outcome)
}

func finalizeRelatedSnapshot(
	ctx context.Context, client recurringCompletionClient, liveID, snapshotID int64,
	key string, outcome CompletionOutcome,
) (vikunja.Task, error) {
	if err := copySnapshotRelations(ctx, client, liveID, snapshotID); err != nil {
		return vikunja.Task{}, err
	}
	return finalizeSnapshot(ctx, client, snapshotID, key, outcome)
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
	return new(value)
}
