package service

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// Relation guard errors distinguish unsafe hierarchy changes from failed upstream writes.
var (
	ErrRelationConflict = errors.New("the relationship would create a cycle or another parent")
	ErrRelationReadOnly = errors.New("history snapshots cannot change relationships")
	ErrRelationLimit    = errors.New("the relationship graph exceeds the supported safety limit")
)

type relationTaskReader interface {
	Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error)
}

const (
	relationTimeout      = 10 * time.Second
	maxRelationAncestors = 1000
)

type relationClient interface {
	TaskRelations(context.Context, int64) (map[vikunja.RelationKind][]vikunja.RelatedTask, error)
	CreateTaskRelation(context.Context, int64, int64, vikunja.RelationKind) error
	DeleteTaskRelation(context.Context, int64, int64, vikunja.RelationKind) error
}

// SetTaskRelation applies one explicit relation intent, reconciling uncertain writes by readback.
// Hierarchy validation is not an atomic lock against edits made in another Vikunja client.
func SetTaskRelation(
	ctx context.Context, tasks relationTaskReader, client relationClient,
	baseID, otherID int64, kind vikunja.RelationKind, remove bool,
) error {
	ctx, cancel := context.WithTimeout(ctx, relationTimeout)
	defer cancel()
	if !validRelationIntent(baseID, otherID, kind, remove) {
		return ErrRelationConflict
	}
	if err := validateRelationTasks(ctx, tasks, baseID, otherID); err != nil {
		return err
	}
	relations, err := client.TaskRelations(ctx, baseID)
	if err != nil {
		return err
	}
	if containsRelation(relations[kind], otherID) != remove {
		return nil
	}
	if !remove && kind == vikunja.RelationChild {
		if err := validateParentRelation(ctx, client, baseID, otherID); err != nil {
			return err
		}
	}
	if remove {
		err = client.DeleteTaskRelation(ctx, baseID, otherID, kind)
	} else {
		err = client.CreateTaskRelation(ctx, baseID, otherID, kind)
	}
	if err == nil {
		return nil
	}
	confirmed, readErr := client.TaskRelations(ctx, baseID)
	if readErr == nil && containsRelation(confirmed[kind], otherID) != remove {
		return nil
	}
	return err
}

func validRelationIntent(baseID, otherID int64, kind vikunja.RelationKind, remove bool) bool {
	return baseID > 0 && otherID > 0 && baseID != otherID &&
		(kind == vikunja.RelationRelated || kind == vikunja.RelationChild || (remove && kind == vikunja.RelationParent))
}

// CanChangeTaskRelations keeps history snapshots and known read-only tasks immutable.
func CanChangeTaskRelations(task vikunja.Task) bool {
	return !hasLabel(task.Labels, recurrenceHistoryLabel) &&
		(task.MaxPermission == nil || *task.MaxPermission > 0)
}

func validateRelationTasks(ctx context.Context, client relationTaskReader, ids ...int64) error {
	errs := make([]error, len(ids))
	var group sync.WaitGroup
	for index, id := range ids {
		group.Go(func() {
			task, _, err := client.Task(ctx, id)
			if err == nil && hasLabel(task.Labels, recurrenceHistoryLabel) {
				err = ErrRelationReadOnly
			}
			errs[index] = err
		})
	}
	group.Wait()
	return errors.Join(errs...)
}

func validateParentRelation(ctx context.Context, client relationClient, parentID, childID int64) error {
	child, err := client.TaskRelations(ctx, childID)
	if err != nil {
		return err
	}
	if len(child[vikunja.RelationParent]) != 0 {
		return ErrRelationConflict
	}
	pending := []int64{parentID}
	queued := map[int64]bool{parentID: true}
	for len(pending) > 0 {
		id := pending[0]
		pending = pending[1:]
		if id == childID {
			return ErrRelationConflict
		}
		relations, err := client.TaskRelations(ctx, id)
		if err != nil {
			return err
		}
		for _, parent := range relations[vikunja.RelationParent] {
			if queued[parent.ID] {
				continue
			}
			if len(queued) >= maxRelationAncestors {
				return ErrRelationLimit
			}
			queued[parent.ID] = true
			pending = append(pending, parent.ID)
		}
	}
	return nil
}

func containsRelation(tasks []vikunja.RelatedTask, id int64) bool {
	for _, task := range tasks {
		if task.ID == id {
			return true
		}
	}
	return false
}
