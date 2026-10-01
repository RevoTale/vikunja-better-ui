package service

import (
	"context"
	"slices"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// ReferenceLinker derives bounded, additive related-task links from confirmed saved content.
type ReferenceLinker struct {
	Policy    TaskReferencePolicy
	Tasks     relationTaskReader
	Relations relationClient
}

// ReferenceLinkResult reports only relation work; the associated content is already saved.
type ReferenceLinkResult struct {
	FailedIDs   []int64
	Limited     bool
	LinkedCount int
}

// Saved links newly introduced references, never restoring a manually removed unchanged link.
func (linker ReferenceLinker) Saved(ctx context.Context, taskID int64, before, after string) ReferenceLinkResult {
	if before == after {
		return ReferenceLinkResult{}
	}
	previous := linker.Policy.Extract(before, taskID)
	current := linker.Policy.Extract(after, taskID)
	if previous.Limited {
		// An incomplete previous set cannot safely distinguish new references.
		return ReferenceLinkResult{Limited: true}
	}
	ids := make([]int64, 0, len(current.IDs))
	for _, id := range current.IDs {
		if !slices.Contains(previous.IDs, id) {
			ids = append(ids, id)
		}
	}
	result := linker.link(ctx, taskID, ids)
	result.Limited = current.Limited
	return result
}

// Repair rechecks the current persisted content before retrying only explicitly selected targets.
// It never changes or recreates the saved description or comment.
func (linker ReferenceLinker) Repair(
	ctx context.Context, taskID int64, content string, requested []int64,
) (ReferenceLinkResult, error) {
	if len(requested) == 0 || len(requested) > maxTaskReferences {
		return ReferenceLinkResult{}, ErrRelationLimit
	}
	current := linker.Policy.Extract(content, taskID)
	ids := make([]int64, 0, len(requested))
	for _, id := range requested {
		if !slices.Contains(current.IDs, id) {
			return ReferenceLinkResult{}, ErrRelationConflict
		}
		if !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	return linker.link(ctx, taskID, ids), nil
}

func (linker ReferenceLinker) link(ctx context.Context, taskID int64, ids []int64) ReferenceLinkResult {
	const timeout = 5 * time.Second
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	result := ReferenceLinkResult{}
	// A single bounded queue avoids concurrent writes to the same upstream task.
	for _, id := range ids {
		if ctx.Err() != nil || linker.Tasks == nil || linker.Relations == nil {
			result.FailedIDs = append(result.FailedIDs, id)
			continue
		}
		err := SetTaskRelation(ctx, linker.Tasks, linker.Relations, taskID, id, vikunja.RelationRelated, false)
		if err != nil {
			result.FailedIDs = append(result.FailedIDs, id)
		} else {
			result.LinkedCount++
		}
	}
	return result
}
