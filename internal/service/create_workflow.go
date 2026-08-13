package service

import (
	"context"
	"fmt"

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
	MissingMarker  string
	RepairCause    error
}

func CreateTaskWithMarker(
	ctx context.Context,
	client taskCreateClient,
	projectID int64,
	input vikunja.TaskWrite,
	markerTitle string,
) (CreationResult, error) {
	if projectID <= 0 {
		return CreationResult{}, fmt.Errorf("project ID must be positive")
	}

	var marker vikunja.Label
	if markerTitle != "" {
		var err error
		marker, err = ResolveMarker(ctx, client, markerTitle)
		if err != nil {
			return CreationResult{}, err
		}
	}

	created, err := client.CreateTask(ctx, projectID, input)
	if err != nil {
		return CreationResult{}, err
	}
	if markerTitle == "" {
		return CreationResult{Task: created}, nil
	}
	if err := client.AttachLabel(ctx, created.ID, marker.ID); err != nil {
		created, _, readErr := client.Task(ctx, created.ID)
		if readErr != nil {
			created = vikunja.Task{ID: created.ID, ProjectID: projectID, Title: input.Title}
		}
		return CreationResult{
			Task: created, RepairRequired: true, MissingMarker: markerTitle, RepairCause: err,
		}, nil
	}
	created.Labels = append(created.Labels, marker)
	confirmed, _, err := client.Task(ctx, created.ID)
	if err != nil {
		return CreationResult{}, err
	}
	return CreationResult{Task: confirmed}, nil
}
