package resolver

import (
	"context"
	"strconv"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

func (resolver *Resolver) referenceLinker() service.ReferenceLinker {
	return service.ReferenceLinker{Policy: resolver.referencePolicy, Tasks: resolver.tasks, Relations: resolver.relations}
}

func referenceResult(taskID, commentID int64, result service.ReferenceLinkResult) *model.TaskReferenceResult {
	mapped := &model.TaskReferenceResult{
		TaskID: strconv.FormatInt(taskID, 10), Limited: result.Limited, FailedTargetIds: []string{},
		LinkedCount: result.LinkedCount,
	}
	if commentID > 0 {
		value := strconv.FormatInt(commentID, 10)
		mapped.CommentID = &value
	}
	for _, id := range result.FailedIDs {
		mapped.FailedTargetIds = append(mapped.FailedTargetIds, strconv.FormatInt(id, 10))
	}
	return mapped
}

// RepairTaskReferences retries only relations still referenced by the persisted resource.
func (r *mutationResolver) RepairTaskReferences(
	ctx context.Context, input model.RepairTaskReferencesInput,
) (*model.TaskReferenceResult, error) {
	if _, err := r.requireCSRF(ctx, input.CsrfToken); err != nil {
		return nil, err
	}
	taskID, err := parsePositiveID(input.TaskID)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Task ID is invalid.")
	}
	ids, err := parseReferenceIDs(input.TargetIds)
	if err != nil {
		return nil, err
	}
	content, commentID, err := r.referenceContent(ctx, taskID, input.CommentID)
	if err != nil {
		return nil, r.relationError(err)
	}
	result, err := r.referenceLinker().Repair(ctx, taskID, content, ids)
	if err != nil {
		return nil, r.relationError(err)
	}
	return referenceResult(taskID, commentID, result), nil
}

func parseReferenceIDs(values []string) ([]int64, error) {
	if len(values) == 0 || len(values) > 20 {
		return nil, clientError("VALIDATION_FAILED", "Choose 1–20 reference targets.")
	}
	ids := make([]int64, 0, len(values))
	for _, value := range values {
		id, err := parsePositiveID(value)
		if err != nil {
			return nil, clientError("VALIDATION_FAILED", "Reference target ID is invalid.")
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (resolver *Resolver) referenceContent(ctx context.Context, taskID int64, comment *string) (string, int64, error) {
	task, _, err := resolver.tasks.Task(ctx, taskID)
	if err != nil {
		return "", 0, err
	}
	if !service.CanChangeTaskRelations(task) {
		return "", 0, service.ErrRelationReadOnly
	}
	if comment == nil {
		return task.Description, 0, nil
	}
	id, err := parsePositiveID(*comment)
	if err != nil {
		return "", 0, service.ErrRelationConflict
	}
	saved, err := resolver.comments.TaskComment(ctx, taskID, id)
	return saved.Comment, id, err
}
