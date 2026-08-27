package resolver

import (
	"context"
	"errors"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func (resolver *Resolver) completeRecurringTask(
	ctx context.Context,
	session auth.Session,
	input model.CompleteTaskInput,
) (*model.CompletionPayload, error) {
	user, projects, location, err := resolver.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	taskID, err := parsePositiveID(input.TaskID)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Task ID is invalid.")
	}
	if input.ExpectedDueAt == nil {
		return nil, clientError("VALIDATION_FAILED", "The recurring occurrence due date is required.")
	}
	result, err := service.CompleteRecurring(
		ctx, resolver.tasks, resolver.capabilities, taskID, *input.ExpectedDueAt, location,
	)
	if err != nil {
		return nil, completionClientError(resolver, err)
	}
	return resolver.recurringCompletionPayload(session, user, projects, result)
}

func (resolver *Resolver) recurringCompletionPayload(
	session auth.Session,
	user vikunja.User,
	projects []vikunja.Project,
	result service.RecurringCompletion,
) (*model.CompletionPayload, error) {
	projectsByID := projectMap(projects)
	liveTask, err := taskModel(
		result.LiveTask, projectsByID, user.Settings.Timezone, resolver.now(), user.Settings.DefaultProjectID,
	)
	if err != nil {
		return nil, clientError("UPSTREAM_REJECTED", "The renewed task uses unsupported fields.")
	}
	if result.RepairRequired {
		capability, capabilityErr := resolver.capabilities.IssueRecurringRepair(session.ID, result.RepairGrant)
		if capabilityErr != nil {
			resolver.logError("issue recurring repair capability", capabilityErr)
			return nil, clientError("INTERNAL", "Recurring task repair could not be authorized.")
		}
		return &model.CompletionPayload{
			Status:           model.CompletionStatusConfirmedRepairRequired,
			NextOccurrence:   liveTask,
			RepairCapability: &capability,
			MissingMarkers:   recurringMissingMarkers(result.RepairGrant.Outcome),
			RemainingRepairSteps: recurringRepairSteps(
				result.RepairGrant.Outcome,
				!result.RepairGrant.TargetDueAt.IsZero() &&
					!result.LiveTask.DueDate.Equal(result.RepairGrant.TargetDueAt),
				!result.RepairGrant.TargetStartAt.IsZero() &&
					(!result.LiveTask.StartDate.Equal(result.RepairGrant.TargetStartAt) ||
						!result.LiveTask.EndDate.Equal(result.RepairGrant.TargetEndAt)),
			),
		}, nil
	}
	snapshot, err := taskModel(
		result.Snapshot, projectsByID, user.Settings.Timezone, resolver.now(), user.Settings.DefaultProjectID,
	)
	if err != nil {
		return nil, clientError("UPSTREAM_REJECTED", "The completed snapshot uses unsupported fields.")
	}
	return &model.CompletionPayload{
		Status: model.CompletionStatusConfirmed, CompletedTask: snapshot, NextOccurrence: liveTask,
		MissingMarkers: []model.MarkerKind{}, RemainingRepairSteps: []model.RepairStep{},
	}, nil
}

func recurringMissingMarkers(outcome service.CompletionOutcome) []model.MarkerKind {
	markers := []model.MarkerKind{model.MarkerKindRecurrenceHistory}
	if outcome == service.CompletionOutcomeSkipped {
		markers = append(markers, model.MarkerKindSkipped)
	}
	return markers
}

func recurringRepairSteps(
	outcome service.CompletionOutcome,
	normalizeDue bool,
	normalizeJobSchedule bool,
) []model.RepairStep {
	steps := make([]model.RepairStep, 0, 4)
	if normalizeJobSchedule {
		steps = append(steps, model.RepairStepNormalizeJobSchedule)
	} else if normalizeDue {
		steps = append(steps, model.RepairStepNormalizeDue)
	}
	steps = append(steps,
		model.RepairStepCreateHistorySnapshot,
		model.RepairStepAttachRecurrenceHistory,
	)
	if outcome == service.CompletionOutcomeSkipped {
		steps = append(steps, model.RepairStepAttachSkipped)
	}
	return steps
}

func recurrenceInterval(input *model.RecurrenceInput) int {
	if input == nil {
		return 0
	}
	return input.Interval
}

func recurrenceUnit(input *model.RecurrenceInput) service.RecurrenceUnit {
	if input == nil {
		return ""
	}
	return service.RecurrenceUnit(input.Unit)
}

func recurrenceMode(input *model.RecurrenceInput) service.RecurrenceMode {
	if input == nil {
		return ""
	}
	return service.RecurrenceMode(input.Mode)
}

func recurrenceKeepDueTime(input *model.RecurrenceInput) bool {
	return input != nil && input.KeepDueTime
}

func (resolver *Resolver) createTaskPayload(
	ctx context.Context,
	session auth.Session,
	user vikunja.User,
	projects []vikunja.Project,
	projectID int64,
	write vikunja.TaskWrite,
	marker string,
) (*model.TaskMutationPayload, error) {
	markers := []string{}
	if marker != "" {
		markers = append(markers, marker)
	}
	return resolver.createTaskPayloadWithMarkers(ctx, session, user, projects, projectID, write, markers)
}

func (resolver *Resolver) createTaskPayloadWithMarkers(
	ctx context.Context,
	session auth.Session,
	user vikunja.User,
	projects []vikunja.Project,
	projectID int64,
	write vikunja.TaskWrite,
	markers []string,
) (*model.TaskMutationPayload, error) {
	result, err := service.CreateTaskWithMarkers(ctx, resolver.tasks, projectID, write, markers)
	if err != nil {
		resolver.logError("create Vikunja task", err)
		return nil, upstreamClientError(err, "The task could not be created. Refresh the list before retrying.")
	}
	mapped, err := taskModel(
		result.Task, projectMap(projects), user.Settings.Timezone, resolver.now(), user.Settings.DefaultProjectID,
	)
	if err != nil {
		resolver.logError("map created task", err)
		return nil, clientError("UPSTREAM_REJECTED", "The created task uses fields this client cannot represent.")
	}
	payload := &model.TaskMutationPayload{
		Task: mapped, Status: model.TaskMutationStatusConfirmed,
		MissingMarkers: []model.MarkerKind{}, RemainingRepairSteps: []model.RepairStep{},
	}
	if !result.RepairRequired {
		return payload, nil
	}
	if resolver.capabilities == nil {
		return nil, clientError("INTERNAL", "Task metadata repair is unavailable.")
	}
	_, metadata, readErr := resolver.tasks.Task(ctx, result.Task.ID)
	if readErr != nil || metadata.ETag == "" {
		resolver.logError("read created task for repair", readErr)
		return nil, clientError("REPAIR_REQUIRED", "The task was created, but its marker could not be attached. Open it in Vikunja to repair it.")
	}
	capability, capabilityErr := resolver.capabilities.IssueMarkerRepair(session.ID, service.MarkerRepairGrant{
		TaskID: result.Task.ID, MarkerTitles: result.MissingMarkers, ETag: metadata.ETag,
	})
	if capabilityErr != nil {
		resolver.logError("issue task repair capability", capabilityErr)
		return nil, clientError("INTERNAL", "Task metadata repair could not be authorized.")
	}
	payload.Status = model.TaskMutationStatusRepairRequired
	payload.MissingMarkers, payload.RemainingRepairSteps = markerModelLists(result.MissingMarkers)
	payload.RepairCapability = &capability
	return payload, nil
}

func accessibleProject(value string, projects []vikunja.Project) (int64, error) {
	projectID, err := parsePositiveID(value)
	if err != nil {
		return 0, clientError("VALIDATION_FAILED", "Project ID is invalid.")
	}
	for _, project := range projects {
		if project.ID == projectID {
			return projectID, nil
		}
	}
	return 0, clientError("FORBIDDEN", "The selected project is not accessible.")
}

func optionalString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func optionalLocalDate(value *model.LocalDate) string {
	if value == nil {
		return ""
	}
	return string(*value)
}

func optionalLocalTime(value *model.LocalTime) string {
	if value == nil {
		return ""
	}
	return string(*value)
}

func validationClientError(err error) error {
	if errors.Is(err, service.ErrUnsupportedRecurrence) {
		return clientError("VALIDATION_FAILED", "Vikunja cannot represent that month interval and recurrence mode.")
	}
	return clientError("VALIDATION_FAILED", err.Error())
}

func markerModels(title string) (model.MarkerKind, model.RepairStep) {
	switch title {
	case "job":
		return model.MarkerKindJob, model.RepairStepAttachJob
	case "vbu:recurrence-history":
		return model.MarkerKindRecurrenceHistory, model.RepairStepAttachRecurrenceHistory
	case "vbu:skipped":
		return model.MarkerKindSkipped, model.RepairStepAttachSkipped
	case "vbu:fixed-due-time":
		return model.MarkerKindFixedDueTime, model.RepairStepAttachFixedDueTime
	default:
		return model.MarkerKindDateOnly, model.RepairStepAttachDateOnly
	}
}

func markerModelLists(titles []string) ([]model.MarkerKind, []model.RepairStep) {
	markers := make([]model.MarkerKind, 0, len(titles))
	steps := make([]model.RepairStep, 0, len(titles))
	for _, title := range titles {
		marker, step := markerModels(title)
		markers = append(markers, marker)
		steps = append(steps, step)
	}
	return markers, steps
}

func deletionClientError(resolver *Resolver, err error) error {
	resolver.logError("delete active task", err)
	switch {
	case errors.Is(err, service.ErrTaskNotActive):
		return clientError("TASK_NOT_ACTIVE", "Only active tasks can be deleted.")
	case errors.Is(err, service.ErrTaskNotAccessible):
		return clientError("FORBIDDEN", "The task project is not accessible.")
	default:
		return upstreamClientError(err, "The task could not be deleted.")
	}
}

func (r *mutationResolver) repairRecurringSnapshot(
	ctx context.Context,
	session auth.Session,
	user vikunja.User,
	projects []vikunja.Project,
	capability string,
) (*model.TaskMutationPayload, error) {
	grant, err := r.capabilities.ParseRecurringRepair(session.ID, capability)
	if err != nil {
		return nil, completionClientError(r.Resolver, err)
	}
	result, err := service.RepairRecurringSnapshot(ctx, r.tasks, grant)
	if err != nil {
		return nil, completionClientError(r.Resolver, err)
	}
	snapshot, err := taskModel(
		result.Snapshot,
		projectMap(projects),
		user.Settings.Timezone,
		r.now(),
		user.Settings.DefaultProjectID,
	)
	if err != nil {
		return nil, clientError("UPSTREAM_REJECTED", "The repaired history entry uses unsupported fields.")
	}
	return &model.TaskMutationPayload{
		Task: snapshot, Status: model.TaskMutationStatusConfirmed,
		MissingMarkers: []model.MarkerKind{}, RemainingRepairSteps: []model.RepairStep{},
	}, nil
}

func completionClientError(resolver *Resolver, err error) error {
	resolver.logError("task completion workflow", err)
	switch {
	case errors.Is(err, service.ErrTaskKindMismatch), errors.Is(err, service.ErrTaskNotActionable):
		return clientError("INVALID_TASK_KIND", "The task no longer matches this action. Refresh it and try again.")
	case errors.Is(err, service.ErrTaskStateChanged):
		return clientError("CONFLICT", "The task changed. Refresh it and try again.")
	case errors.Is(err, service.ErrInvalidCapability), errors.Is(err, service.ErrExpiredCapability):
		return clientError("FORBIDDEN", "This action has expired. Refresh the task.")
	default:
		return upstreamClientError(err, "The task action could not be completed.")
	}
}
