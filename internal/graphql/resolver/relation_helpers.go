package resolver

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"strings"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func (resolver *Resolver) relationshipModel(ctx context.Context, id int64) (*model.TaskRelationships, error) {
	state, err := resolver.relations.TaskRelationState(ctx, id)
	if err != nil {
		return nil, resolver.relationError(err)
	}
	relations := state.Relations
	return &model.TaskRelationships{
		TaskID: strconv.FormatInt(id, 10), CanEdit: service.CanChangeTaskRelations(state.Task),
		Parents:  relatedTaskModels(relations[vikunja.RelationParent]),
		Children: relatedTaskModels(relations[vikunja.RelationChild]),
		Related:  relatedTaskModels(relations[vikunja.RelationRelated]),
	}, nil
}

func relatedTaskModel(task vikunja.RelatedTask) *model.RelatedTask {
	return &model.RelatedTask{ID: strconv.FormatInt(task.ID, 10), Title: task.Title, IsDone: task.Done}
}

func relatedTaskModels(tasks []vikunja.RelatedTask) []*model.RelatedTask {
	items := make([]*model.RelatedTask, 0, len(tasks))
	for _, task := range tasks {
		items = append(items, relatedTaskModel(task))
	}
	slices.SortFunc(items, func(left, right *model.RelatedTask) int {
		if compared := strings.Compare(left.Title, right.Title); compared != 0 {
			return compared
		}
		return strings.Compare(left.ID, right.ID)
	})
	return items
}

func (resolver *Resolver) relationError(err error) error {
	resolver.logError("task relationship workflow", err)
	switch {
	case errors.Is(err, service.ErrRelationConflict):
		return clientError("CONFLICT", "This would create a cycle or another parent. Refresh the tasks first.")
	case errors.Is(err, service.ErrRelationReadOnly):
		return clientError("FORBIDDEN", "History snapshots and read-only tasks cannot change relationships.")
	case errors.Is(err, service.ErrRelationLimit):
		return clientError("VALIDATION_FAILED", "This hierarchy is too large to check safely.")
	default:
		return upstreamClientError(err, "The relationship could not be confirmed. Refresh before retrying.")
	}
}
