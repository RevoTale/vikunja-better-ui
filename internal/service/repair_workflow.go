package service

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type markerRepairClient interface {
	markerClient
	Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error)
	AttachLabel(context.Context, int64, int64) error
}

type MarkerRepairResult struct {
	Task       vikunja.Task
	Complete   bool
	Capability string
	Cause      error
}

func RepairMarker(
	ctx context.Context,
	client markerRepairClient,
	capabilities *CapabilityManager,
	sessionID string,
	capability string,
) (MarkerRepairResult, error) {
	grant, err := capabilities.ParseMarkerRepair(sessionID, capability)
	if err != nil {
		return MarkerRepairResult{}, err
	}
	task, metadata, err := client.Task(ctx, grant.TaskID)
	if err != nil {
		return MarkerRepairResult{}, err
	}
	missing := missingMarkerTitles(task.Labels, grant.MarkerTitles)
	if len(missing) == 0 {
		return MarkerRepairResult{Task: task, Complete: true}, nil
	}
	if metadata.ETag == "" || metadata.ETag != grant.ETag {
		return MarkerRepairResult{}, ErrTaskStateChanged
	}

	for _, title := range missing {
		marker, resolveErr := ResolveMarker(ctx, client, title)
		if resolveErr != nil {
			return reconcileMarkers(ctx, client, capabilities, sessionID, capability, grant, task, resolveErr)
		}
		if attachErr := client.AttachLabel(ctx, task.ID, marker.ID); attachErr != nil {
			return reconcileMarkers(ctx, client, capabilities, sessionID, capability, grant, task, attachErr)
		}
	}
	return reconcileMarkers(ctx, client, capabilities, sessionID, capability, grant, task, nil)
}

func reconcileMarkers(
	ctx context.Context,
	client markerRepairClient,
	capabilities *CapabilityManager,
	sessionID string,
	capability string,
	grant MarkerRepairGrant,
	previous vikunja.Task,
	cause error,
) (MarkerRepairResult, error) {
	current, metadata, err := client.Task(ctx, grant.TaskID)
	if err != nil {
		if cause == nil {
			cause = err
		}
		return MarkerRepairResult{Task: previous, Capability: capability, Cause: cause}, nil
	}
	missing := missingMarkerTitles(current.Labels, grant.MarkerTitles)
	if len(missing) == 0 {
		return MarkerRepairResult{Task: current, Complete: true}, nil
	}
	if metadata.ETag == "" {
		return MarkerRepairResult{}, vikunja.ErrRejectedResponse
	}
	refreshedCapability, err := capabilities.IssueMarkerRepair(sessionID, MarkerRepairGrant{
		TaskID: current.ID, MarkerTitles: missing, ETag: metadata.ETag,
	})
	if err != nil {
		return MarkerRepairResult{}, err
	}
	if cause == nil {
		cause = vikunja.ErrRejectedResponse
	}
	return MarkerRepairResult{Task: current, Capability: refreshedCapability, Cause: cause}, nil
}
