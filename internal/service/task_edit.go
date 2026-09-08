package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

var ErrEditPartial = errors.New("task fields saved but metadata could not be confirmed")

type EditTaskInput struct {
	TaskID          int64
	ExpectedVersion string
	ProjectID       int64
	Title           string
	Description     string
	Priority        int64
	Job             bool
	DueDate         string
	DueTime         string
	StartLocal      string
	EndLocal        string
	Recurrence      *RecurringInput
}

type taskEditClient interface {
	recurrenceSettingClient
	PatchTaskChecked(context.Context, int64, vikunja.TaskPatch, vikunja.TaskCheck) (vikunja.Task, error)
}

// TaskVersion binds an editor to the complete upstream representation it loaded.
func TaskVersion(task vikunja.Task) string {
	encoded, _ := json.Marshal(task) // Task contains only JSON-safe scalar values.
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:])
}

func EditTask(ctx context.Context, client taskEditClient, input EditTaskInput, location *time.Location, projects []int64) (vikunja.Task, error) {
	before, _, err := client.Task(ctx, input.TaskID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if before.Done || hasLabel(before.Labels, recurrenceHistoryLabel) || hasLabel(before.Labels, skippedLabel) {
		return vikunja.Task{}, ErrTaskNotActive
	}
	if !containsID(projects, before.ProjectID) || !containsID(projects, input.ProjectID) {
		return vikunja.Task{}, ErrTaskNotAccessible
	}
	if input.ExpectedVersion == "" || input.ExpectedVersion != TaskVersion(before) {
		return vikunja.Task{}, vikunja.ErrConditionFailed
	}
	write, markers, err := BuildEditedTask(input, location)
	if err != nil {
		return vikunja.Task{}, err
	}
	// The UI edits minutes. Preserve upstream seconds when that minute was not changed.
	preserveEditPrecision(write.StartDate, before.StartDate)
	preserveEditPrecision(write.EndDate, before.EndDate)
	if hasLabel(before.Labels, dateOnlyLabel) == markers[dateOnlyLabel] {
		preserveEditPrecision(write.DueDate, before.DueDate)
	}
	patch := vikunja.TaskPatch{
		Title: &write.Title, Description: &write.Description, ProjectID: &input.ProjectID, Priority: &write.Priority,
		DueDate: write.DueDate, StartDate: write.StartDate, EndDate: write.EndDate,
		RepeatAfter: &write.RepeatAfter, RepeatMode: &write.RepeatMode,
	}
	check := vikunja.TaskCheck{
		Updated: &before.Updated, Title: &before.Title, Description: &before.Description,
		ProjectID: &before.ProjectID, Priority: &before.Priority, Done: &before.Done,
		DueDate: &before.DueDate, StartDate: &before.StartDate, EndDate: &before.EndDate,
		RepeatAfter: &before.RepeatAfter, RepeatMode: &before.RepeatMode,
	}
	if _, err := client.PatchTaskChecked(ctx, before.ID, patch, check); err != nil {
		return vikunja.Task{}, err
	}
	if err := updateEditMarkers(ctx, client, before, markers); err != nil {
		return vikunja.Task{}, errors.Join(ErrEditPartial, err)
	}
	confirmed, _, err := client.Task(ctx, before.ID)
	if err != nil {
		return vikunja.Task{}, errors.Join(ErrEditPartial, err)
	}
	if confirmed.Done || confirmed.Title != write.Title || confirmed.Description != write.Description || confirmed.ProjectID != input.ProjectID ||
		confirmed.Priority != write.Priority || confirmed.RepeatAfter != write.RepeatAfter ||
		confirmed.RepeatMode != write.RepeatMode || !confirmed.DueDate.Equal(*write.DueDate) ||
		!confirmed.StartDate.Equal(*write.StartDate) || !confirmed.EndDate.Equal(*write.EndDate) {
		return vikunja.Task{}, errors.Join(ErrEditPartial, vikunja.ErrRejectedResponse)
	}
	for title, wanted := range markers {
		if hasLabel(confirmed.Labels, title) != wanted {
			return vikunja.Task{}, errors.Join(ErrEditPartial, vikunja.ErrRejectedResponse)
		}
	}
	return confirmed, nil
}

func preserveEditPrecision(next *time.Time, before time.Time) {
	if !next.IsZero() && next.Truncate(time.Minute).Equal(before.Truncate(time.Minute)) {
		*next = before
	}
}

func updateEditMarkers(ctx context.Context, client taskEditClient, before vikunja.Task, desired map[string]bool) error {
	for _, title := range []string{jobLabel, dateOnlyLabel, fixedDueTimeLabel} {
		if desired[title] {
			if hasLabel(before.Labels, title) {
				continue
			}
			label, err := ResolveMarker(ctx, client, title)
			if err != nil {
				return err
			}
			if err := client.AttachLabel(ctx, before.ID, label.ID); err != nil {
				return err
			}
		} else {
			for _, label := range exactLabels(before.Labels, title) {
				if err := client.DetachLabel(ctx, before.ID, label.ID); err != nil {
					return err
				}
			}
		}
	}
	return nil
}
