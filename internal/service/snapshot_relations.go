package service

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type snapshotRelationClient interface {
	TaskRelations(context.Context, int64) (map[vikunja.RelationKind][]vikunja.RelatedTask, error)
	CreateTaskRelation(context.Context, int64, int64, vikunja.RelationKind) error
}

// Only related links belong on history. Comments and child/parent ownership stay
// on the live series; no task duplication endpoint is used.
func copySnapshotRelations(ctx context.Context, client snapshotRelationClient, liveID, snapshotID int64) error {
	source, err := client.TaskRelations(ctx, liveID)
	if err != nil {
		return err
	}
	if len(source[vikunja.RelationRelated]) == 0 {
		return nil
	}
	existing, err := client.TaskRelations(ctx, snapshotID)
	if err != nil {
		return err
	}
	present := make(map[int64]bool, len(existing[vikunja.RelationRelated]))
	for _, relation := range existing[vikunja.RelationRelated] {
		present[relation.ID] = true
	}
	for _, relation := range source[vikunja.RelationRelated] {
		if present[relation.ID] || relation.ID == snapshotID {
			continue
		}
		if err := client.CreateTaskRelation(ctx, snapshotID, relation.ID, vikunja.RelationRelated); err != nil {
			return err
		}
		present[relation.ID] = true
	}
	return nil
}
