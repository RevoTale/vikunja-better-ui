package resolver

import (
	"context"
	"errors"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func (r *mutationResolver) UpdateTask(ctx context.Context, input model.UpdateTaskInput) (*model.Task, error) {
	if _, err := r.requireCSRF(ctx, input.CsrfToken); err != nil {
		return nil, err
	}
	user, projects, location, err := r.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	projectID, err := accessibleProject(input.ProjectID, projects)
	if err != nil {
		return nil, err
	}
	taskID, err := parsePositiveID(input.TaskID)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Task ID is invalid.")
	}
	priority, err := priorityValue(input.Priority)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Choose a valid priority.")
	}
	edit := service.EditTaskInput{
		TaskID: taskID, ExpectedVersion: input.ExpectedVersion, ProjectID: projectID,
		Title: input.Title, Description: input.Description, Priority: priority, Job: input.Job,
		DueDate: optionalLocalDate(input.DueDate), DueTime: optionalLocalTime(input.DueTime),
	}
	if input.StartAt != nil {
		edit.StartLocal = string(*input.StartAt)
	}
	if input.EndAt != nil {
		edit.EndLocal = string(*input.EndAt)
	}
	if input.Recurrence != nil {
		edit.Recurrence = &service.RecurringInput{
			Interval: input.Recurrence.Interval, Unit: service.RecurrenceUnit(input.Recurrence.Unit),
			Mode: service.RecurrenceMode(input.Recurrence.Mode), KeepDueTime: input.Recurrence.KeepDueTime,
		}
	}
	ids := make([]int64, 0, len(projects))
	for _, project := range projects {
		ids = append(ids, project.ID)
	}
	task, err := service.EditTask(ctx, r.tasks, edit, location, ids)
	if err != nil {
		return nil, editClientError(r.Resolver, err)
	}
	return taskModel(task, projectMap(projects), user.Settings.Timezone, r.now(), user.Settings.DefaultProjectID)
}

func editClientError(resolver *Resolver, err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidEdit):
		return validationClientError(err)
	case errors.Is(err, service.ErrTaskNotActive):
		return clientError("TASK_NOT_ACTIVE", "Completed tasks and history are read-only.")
	case errors.Is(err, service.ErrTaskNotAccessible):
		return clientError("FORBIDDEN", "The task project is not accessible.")
	case errors.Is(err, service.ErrEditPartial):
		resolver.logError("edit task metadata", err)
		return clientError("EDIT_PARTIAL", "Some changes may have been saved, but the update could not be confirmed. Reload the task before editing again.")
	case errors.Is(err, vikunja.ErrConditionFailed):
		return clientError("CONFLICT", "The task changed since you opened it. Your input is preserved. Reload the task before saving again.")
	default:
		resolver.logError("edit task", err)
		return upstreamClientError(err, "The update could not be confirmed. Reload the task before retrying.")
	}
}
