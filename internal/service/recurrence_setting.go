package service

import (
	"context"
	"errors"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type recurrenceSettingClient interface {
	markerClient
	Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error)
	AttachLabel(context.Context, int64, int64) error
	DetachLabel(context.Context, int64, int64) error
}

func SetFixedDueTime(
	ctx context.Context,
	client recurrenceSettingClient,
	taskID int64,
	enabled bool,
) (vikunja.Task, error) {
	task, _, err := client.Task(ctx, taskID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if enabled {
		return enableFixedDueTime(ctx, client, task)
	}
	return disableFixedDueTime(ctx, client, task)
}

func enableFixedDueTime(
	ctx context.Context,
	client recurrenceSettingClient,
	task vikunja.Task,
) (vikunja.Task, error) {
	if !fixedDueTimeEligible(task) {
		return vikunja.Task{}, ErrTaskKindMismatch
	}
	if hasLabel(task.Labels, fixedDueTimeLabel) {
		return task, nil
	}
	marker, err := ResolveMarker(ctx, client, fixedDueTimeLabel)
	if err != nil {
		return vikunja.Task{}, err
	}
	if err := client.AttachLabel(ctx, task.ID, marker.ID); err != nil {
		return vikunja.Task{}, err
	}
	return confirmFixedDueTime(ctx, client, task.ID, true)
}

func disableFixedDueTime(
	ctx context.Context,
	client recurrenceSettingClient,
	task vikunja.Task,
) (vikunja.Task, error) {
	markers := exactLabels(task.Labels, fixedDueTimeLabel)
	if len(markers) == 0 {
		return task, nil
	}
	if task.Done || hasLabel(task.Labels, recurrenceHistoryLabel) {
		return vikunja.Task{}, ErrTaskKindMismatch
	}
	for _, marker := range markers {
		if err := client.DetachLabel(ctx, task.ID, marker.ID); err != nil {
			return vikunja.Task{}, err
		}
	}
	return confirmFixedDueTime(ctx, client, task.ID, false)
}

func confirmFixedDueTime(
	ctx context.Context,
	client recurrenceSettingClient,
	taskID int64,
	enabled bool,
) (vikunja.Task, error) {
	confirmed, _, err := client.Task(ctx, taskID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if hasLabel(confirmed.Labels, fixedDueTimeLabel) != enabled {
		return vikunja.Task{}, vikunja.ErrRejectedResponse
	}
	if enabled && !ClassifyTask(confirmed).Recurring {
		return vikunja.Task{}, errors.New("fixed due time marker produced an invalid task")
	}
	return confirmed, nil
}

func exactLabels(labels []vikunja.Label, title string) []vikunja.Label {
	matching := make([]vikunja.Label, 0, 1)
	for _, label := range labels {
		if label.Title == title {
			matching = append(matching, label)
		}
	}
	return matching
}
