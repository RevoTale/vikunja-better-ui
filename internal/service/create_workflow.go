package service

import (
	"context"
	"errors"
	"slices"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type taskCreateClient interface {
	markerClient
	CreateTask(context.Context, int64, vikunja.TaskWrite) (vikunja.Task, error)
	Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error)
	AttachLabel(context.Context, int64, int64) error
}

type CreationResult struct {
	Task           vikunja.Task
	RepairRequired bool
	MissingMarkers []string
	RepairCause    error
}

func CreateTaskWithMarker(
	ctx context.Context,
	client taskCreateClient,
	projectID int64,
	input vikunja.TaskWrite,
	markerTitle string,
) (CreationResult, error) {
	markers := []string{}
	if markerTitle != "" {
		markers = append(markers, markerTitle)
	}
	return CreateTaskWithMarkers(ctx, client, projectID, input, markers)
}

func CreateTaskWithMarkers(
	ctx context.Context,
	client taskCreateClient,
	projectID int64,
	input vikunja.TaskWrite,
	markerTitles []string,
) (CreationResult, error) {
	if projectID <= 0 {
		return CreationResult{}, errors.New("project ID must be positive")
	}

	markers := make([]vikunja.Label, 0, len(markerTitles))
	for _, title := range markerTitles {
		marker, err := ResolveMarker(ctx, client, title)
		if err != nil {
			return CreationResult{}, err
		}
		if !hasLabelID(markers, marker.ID) {
			markers = append(markers, marker)
		}
	}

	created, err := client.CreateTask(ctx, projectID, input)
	if err != nil {
		return CreationResult{}, err
	}
	if len(markers) == 0 {
		return CreationResult{Task: created}, nil
	}
	var attachErr error
	for _, marker := range markers {
		if err := client.AttachLabel(ctx, created.ID, marker.ID); err != nil {
			attachErr = err
			break
		}
	}
	confirmed, _, err := client.Task(ctx, created.ID)
	if err != nil {
		if attachErr == nil {
			return CreationResult{}, err
		}
		confirmed = vikunja.Task{ID: created.ID, ProjectID: projectID, Title: input.Title}
	}
	missing := missingMarkerTitles(confirmed.Labels, markerTitles)
	if len(missing) > 0 {
		if attachErr == nil {
			attachErr = vikunja.ErrRejectedResponse
		}
		return CreationResult{
			Task: confirmed, RepairRequired: true, MissingMarkers: missing, RepairCause: attachErr,
		}, nil
	}
	return CreationResult{Task: confirmed}, nil
}

func missingMarkerTitles(labels []vikunja.Label, titles []string) []string {
	missing := make([]string, 0, len(titles))
	for _, title := range titles {
		if !hasLabel(labels, title) && !slices.Contains(missing, title) {
			missing = append(missing, title)
		}
	}
	return missing
}
