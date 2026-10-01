package resolver

import (
	"context"
	"errors"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// CreateSubtask reports partial success without inviting duplicate task creation.
func (r *mutationResolver) CreateSubtask(
	ctx context.Context, input model.CreateSubtaskInput,
) (*model.CreateSubtaskPayload, error) {
	if _, err := r.requireCSRF(ctx, input.CsrfToken); err != nil {
		return nil, err
	}
	parentID, err := parsePositiveID(input.ParentTaskID)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Parent task ID is invalid.")
	}
	properties, err := subtaskProperties(input)
	if err != nil {
		return nil, err
	}
	result, err := service.CreateSubtask(ctx, r.tasks, r.relations, parentID, properties)
	if err != nil {
		return nil, subtaskError(err)
	}
	task := result.Creation.Task
	payload := &model.CreateSubtaskPayload{
		Task: relatedTaskModel(vikunja.RelatedTask{ID: task.ID, Title: task.Title, Done: task.Done}),
	}
	if result.RelationError != nil {
		r.logError("link created subtask", result.RelationError)
		message := "Task created, but linking could not be confirmed. Retry linking; do not create it again."
		payload.RelationError = &message
	}
	if result.Creation.LabelError != nil {
		r.logError("attach subtask labels", result.Creation.LabelError)
		message := "Task created, but labels could not be confirmed. Open it to review labels."
		payload.LabelError = &message
	}
	return payload, nil
}

func subtaskError(err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidSubtask), errors.Is(err, service.ErrInvalidLabels):
		return clientError("VALIDATION_FAILED", "Check the subtask title, project, priority and labels.")
	case errors.Is(err, service.ErrRelationReadOnly):
		return clientError("FORBIDDEN", "This task cannot have new subtasks.")
	default:
		return upstreamClientError(err, "Subtask creation could not be confirmed. Refresh before retrying.")
	}
}

func subtaskProperties(input model.CreateSubtaskInput) (service.SubtaskInput, error) {
	properties := service.SubtaskInput{Title: input.Title}
	if input.ProjectID != nil {
		id, err := parsePositiveID(*input.ProjectID)
		if err != nil {
			return properties, clientError("VALIDATION_FAILED", "Project ID is invalid.")
		}
		properties.ProjectID = &id
	}
	if input.Priority != nil {
		priority, err := priorityValue(*input.Priority)
		if err != nil {
			return properties, clientError("VALIDATION_FAILED", "Priority is invalid.")
		}
		properties.Priority = &priority
	}
	if input.LabelIds != nil {
		labels, err := parseLabelIDs(input.LabelIds)
		if err != nil {
			return properties, err
		}
		properties.LabelIDs = labels
	}
	return properties, nil
}
