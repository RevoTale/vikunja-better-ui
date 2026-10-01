package resolver

import (
	"context"
	"strings"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

// CreateOneTimeTask is the resolver for the createOneTimeTask field.
func (r *mutationResolver) CreateOneTimeTask(
	ctx context.Context, input model.CreateOneTimeTaskInput,
) (*model.TaskMutationPayload, error) {
	session, err := r.requireCSRF(ctx, input.CsrfToken)
	if err != nil {
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
	priority, err := priorityValue(input.Priority)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Choose a valid priority.")
	}
	write, dateOnly, err := service.BuildOneTimeTask(service.OneTimeInput{
		Title: input.Title, Description: optionalString(input.Description), Priority: priority,
		DueDate: optionalLocalDate(input.DueDate), DueTime: optionalLocalTime(input.DueTime),
	}, location)
	if err != nil {
		return nil, validationClientError(err)
	}
	marker := ""
	if dateOnly {
		marker = "vbu:date-only"
	}
	write.DescriptionHTML = input.DescriptionFormat == model.TaskDescriptionFormatHTML
	return r.createTaskPayload(ctx, session, user, projects, projectID, write, marker, input.LabelIds)
}

// CreateRecurringTask is the resolver for the createRecurringTask field.
func (r *mutationResolver) CreateRecurringTask(
	ctx context.Context, input model.CreateRecurringTaskInput,
) (*model.TaskMutationPayload, error) {
	session, err := r.requireCSRF(ctx, input.CsrfToken)
	if err != nil {
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
	priority, err := priorityValue(input.Priority)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Choose a valid priority.")
	}
	write, dateOnly, err := service.BuildRecurringTask(service.RecurringInput{
		Title: input.Title, Description: optionalString(input.Description), Priority: priority,
		FirstDueDate: string(input.FirstDueDate), DueTime: optionalLocalTime(input.DueTime), Interval: input.Interval,
		Unit: service.RecurrenceUnit(input.Unit), Mode: service.RecurrenceMode(input.Mode),
		KeepDueTime: input.KeepDueTime,
	}, location)
	if err != nil {
		return nil, validationClientError(err)
	}
	marker := ""
	if dateOnly {
		marker = "vbu:date-only"
	} else if input.KeepDueTime {
		marker = "vbu:fixed-due-time"
	}
	write.DescriptionHTML = input.DescriptionFormat == model.TaskDescriptionFormatHTML
	return r.createTaskPayload(ctx, session, user, projects, projectID, write, marker, input.LabelIds)
}

// CreateJob is the resolver for the createJob field.
func (r *mutationResolver) CreateJob(
	ctx context.Context, input model.CreateJobInput,
) (*model.TaskMutationPayload, error) {
	session, err := r.requireCSRF(ctx, input.CsrfToken)
	if err != nil {
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
	priority, err := priorityValue(input.Priority)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Choose a valid priority.")
	}
	write, err := service.BuildJobTask(service.JobInput{
		Title: optionalString(input.Title), Description: optionalString(input.Description), Priority: priority,
		StartLocal: string(input.StartAt), DurationMinutes: input.DurationMinutes,
		CompletionWindowMinutes: input.CompletionWindowMinutes,
		Interval:                recurrenceInterval(input.Recurrence), Unit: recurrenceUnit(input.Recurrence),
		Mode: recurrenceMode(input.Recurrence), KeepDueTime: recurrenceKeepDueTime(input.Recurrence),
	}, location)
	if err != nil {
		return nil, validationClientError(err)
	}
	markers := []string{"vbu:job"}
	if input.Recurrence != nil && input.Recurrence.KeepDueTime {
		markers = append(markers, "vbu:fixed-due-time")
	}
	write.DescriptionHTML = input.DescriptionFormat == model.TaskDescriptionFormatHTML
	return r.createTaskPayloadWithMarkers(ctx, session, user, projects, projectID, write, markers, input.LabelIds)
}

// CompleteTask is the resolver for the completeTask field.
func (r *mutationResolver) CompleteTask(
	ctx context.Context, input model.CompleteTaskInput,
) (*model.CompletionPayload, error) {
	session, err := r.requireCSRF(ctx, input.CsrfToken)
	if err != nil {
		return nil, err
	}
	if input.ExpectedKind == model.TaskKindRecurring || input.ExpectedRecurring {
		if input.ExpectedKind != model.TaskKindRecurring && input.ExpectedKind != model.TaskKindJob {
			return nil, clientError("INVALID_TASK_KIND", "This task cannot be completed as recurring.")
		}
		return r.completeRecurringTask(ctx, session, input)
	}
	if input.ExpectedKind != model.TaskKindOneTime && input.ExpectedKind != model.TaskKindJob {
		return nil, clientError("INVALID_TASK_KIND", "This task cannot be completed from the app.")
	}
	user, projects, _, err := r.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	taskID, err := parsePositiveID(input.TaskID)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Task ID is invalid.")
	}
	result, err := service.CompleteNonRecurring(
		ctx, r.tasks, r.capabilities, session.ID, taskID, service.TaskKind(input.ExpectedKind),
	)
	if err != nil {
		return nil, completionClientError(r.Resolver, err)
	}
	mapped, err := taskModel(
		result.Task, projectMap(projects), user.Settings.Timezone, r.now(), user.Settings.DefaultProjectID,
	)
	if err != nil {
		r.logError("map completed task", err)
		return nil, clientError("UPSTREAM_REJECTED", "The completed task uses unsupported fields.")
	}
	return &model.CompletionPayload{
		Status: model.CompletionStatusConfirmed, CompletedTask: mapped,
		UndoUntil: &result.UndoUntil, UndoCapability: &result.UndoCapability,
		MissingMarkers: []model.MarkerKind{}, RemainingRepairSteps: []model.RepairStep{},
	}, nil
}

// SkipRecurringTask is the resolver for the skipRecurringTask field.
func (r *mutationResolver) SkipRecurringTask(
	ctx context.Context, input model.SkipRecurringTaskInput,
) (*model.CompletionPayload, error) {
	session, err := r.requireCSRF(ctx, input.CsrfToken)
	if err != nil {
		return nil, err
	}
	taskID, err := parsePositiveID(input.TaskID)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Task ID is invalid.")
	}
	user, projects, location, err := r.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	result, err := service.SkipRecurring(
		ctx, r.tasks, r.capabilities, taskID, input.ExpectedDueAt, location,
	)
	if err != nil {
		return nil, completionClientError(r.Resolver, err)
	}
	return r.recurringCompletionPayload(session, user, projects, result)
}

// SetRecurringKeepDueTime is the resolver for the setRecurringKeepDueTime field.
func (r *mutationResolver) SetRecurringKeepDueTime(
	ctx context.Context,
	input model.SetRecurringKeepDueTimeInput,
) (*model.TaskMutationPayload, error) {
	if _, err := r.requireCSRF(ctx, input.CsrfToken); err != nil {
		return nil, err
	}
	user, projects, _, err := r.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	taskID, err := parsePositiveID(input.TaskID)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Task ID is invalid.")
	}
	task, err := service.SetFixedDueTime(ctx, r.tasks, taskID, input.Enabled)
	if err != nil {
		return nil, completionClientError(r.Resolver, err)
	}
	mapped, err := taskModel(
		task, projectMap(projects), user.Settings.Timezone, r.now(), user.Settings.DefaultProjectID,
	)
	if err != nil {
		return nil, clientError("UPSTREAM_REJECTED", "The updated task uses unsupported fields.")
	}
	return &model.TaskMutationPayload{
		Task: mapped, Status: model.TaskMutationStatusConfirmed,
		MissingMarkers: []model.MarkerKind{}, RemainingRepairSteps: []model.RepairStep{},
	}, nil
}

// DeleteTask is the resolver for the deleteTask field.
func (r *mutationResolver) DeleteTask(
	ctx context.Context, input model.DeleteTaskInput,
) (*model.DeleteTaskPayload, error) {
	if _, err := r.requireCSRF(ctx, input.CsrfToken); err != nil {
		return nil, err
	}
	taskID, err := parsePositiveID(input.TaskID)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Task ID is invalid.")
	}
	_, projects, _, err := r.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	projectIDs := make([]int64, 0, len(projects))
	for _, project := range projects {
		projectIDs = append(projectIDs, project.ID)
	}
	if err := service.DeleteActiveTask(ctx, r.tasks, taskID, projectIDs); err != nil {
		return nil, deletionClientError(r.Resolver, err)
	}
	return &model.DeleteTaskPayload{DeletedTaskID: input.TaskID}, nil
}

// UndoTaskCompletion is the resolver for the undoTaskCompletion field.
func (r *mutationResolver) UndoTaskCompletion(
	ctx context.Context, input model.UndoTaskCompletionInput,
) (*model.TaskMutationPayload, error) {
	session, err := r.requireCSRF(ctx, input.CsrfToken)
	if err != nil {
		return nil, err
	}
	user, projects, _, err := r.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	task, err := service.UndoNonRecurring(ctx, r.tasks, r.capabilities, session.ID, input.Capability)
	if err != nil {
		return nil, completionClientError(r.Resolver, err)
	}
	mapped, err := taskModel(task, projectMap(projects), user.Settings.Timezone, r.now(), user.Settings.DefaultProjectID)
	if err != nil {
		return nil, clientError("UPSTREAM_REJECTED", "The restored task uses unsupported fields.")
	}
	return &model.TaskMutationPayload{
		Task: mapped, Status: model.TaskMutationStatusConfirmed,
		MissingMarkers: []model.MarkerKind{}, RemainingRepairSteps: []model.RepairStep{},
	}, nil
}

// RepairTaskMetadata is the resolver for the repairTaskMetadata field.
func (r *mutationResolver) RepairTaskMetadata(
	ctx context.Context, input model.RepairTaskMetadataInput,
) (*model.TaskMutationPayload, error) {
	session, err := r.requireCSRF(ctx, input.CsrfToken)
	if err != nil {
		return nil, err
	}
	user, projects, _, err := r.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	if strings.HasPrefix(input.Capability, "rr.") {
		return r.repairRecurringSnapshot(ctx, session, user, projects, input.Capability)
	}
	result, err := service.RepairMarker(ctx, r.tasks, r.capabilities, session.ID, input.Capability)
	if err != nil {
		return nil, completionClientError(r.Resolver, err)
	}
	mapped, err := taskModel(
		result.Task,
		projectMap(projects),
		user.Settings.Timezone,
		r.now(),
		user.Settings.DefaultProjectID,
	)
	if err != nil {
		return nil, clientError("UPSTREAM_REJECTED", "The repaired task uses unsupported fields.")
	}
	payload := &model.TaskMutationPayload{
		Task: mapped, Status: model.TaskMutationStatusConfirmed,
		MissingMarkers: []model.MarkerKind{}, RemainingRepairSteps: []model.RepairStep{},
	}
	if !result.Complete {
		grant, parseErr := r.capabilities.ParseMarkerRepair(session.ID, result.Capability)
		if parseErr != nil {
			return nil, clientError("INTERNAL", "Task repair could not be continued.")
		}
		payload.Status = model.TaskMutationStatusRepairRequired
		payload.MissingMarkers, payload.RemainingRepairSteps = markerModelLists(grant.MarkerTitles)
		payload.RepairCapability = &result.Capability
	}
	return payload, nil
}
