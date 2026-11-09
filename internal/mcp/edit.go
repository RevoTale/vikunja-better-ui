package mcp

import (
	"context"
	"slices"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

type editInput struct {
	TaskID          int64            `json:"taskId"`
	ExpectedVersion string           `json:"expectedVersion"`
	Title           *string          `json:"title,omitempty"`
	DescriptionHTML *string          `json:"descriptionHtml,omitempty"`
	ProjectID       *int64           `json:"projectId,omitempty"`
	Priority        *int64           `json:"priority,omitempty"`
	DueDate         *string          `json:"dueDate,omitempty"`
	DueTime         *string          `json:"dueTime,omitempty"`
	StartAt         *string          `json:"startAt,omitempty"`
	EndAt           *string          `json:"endAt,omitempty"`
	PlanningWindow  *windowInput     `json:"planningWindow,omitempty"`
	Recurrence      *recurrenceInput `json:"recurrence,omitempty"`
	LabelIDs        []int64          `json:"labelIds,omitempty"`
	Reminders       []reminderInput  `json:"reminders,omitempty"`
	Clear           []string         `json:"clear,omitempty"           jsonschema:"deadline, startAt, endAt or recurrence"`
}

func updateTask(
	ctx context.Context, _ *sdk.CallToolRequest, input editInput,
) (*sdk.CallToolResult, mutationOutput, error) {
	c, user, location, err := taskContext(ctx)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	before, _, err := c.client.Task(ctx, input.TaskID)
	if err != nil {
		return nil, mutationOutput{}, errorsForTool("Task could not be read.")
	}
	if input.ExpectedVersion == "" || service.TaskVersion(before) != input.ExpectedVersion {
		return nil, mutationOutput{}, errorsForTool("CONFLICT: reload task before editing.")
	}
	edit, err := mergedEdit(before, input, location)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	projects, err := c.client.Projects(ctx)
	if err != nil {
		return nil, mutationOutput{}, errorsForTool("Project access could not be checked.")
	}
	ids := make([]int64, 0, len(projects))
	for _, project := range projects {
		ids = append(ids, project.ID)
	}
	saved, links, err := service.EditTaskWithReferences(ctx, c.client, edit, location, ids, c.linker)
	if err != nil {
		return nil, mutationOutput{}, errorsForTool(
			"Edit was not confirmed. It may be partial or conflicted; reload before retrying.")
	}
	output := mutationOutput{Task: mutationDetail(saved, user.Settings.Timezone, c), Status: statusConfirmed}
	if links.Limited || len(links.FailedIDs) > 0 {
		output.Warning = "Some reference links could not be confirmed."
	}
	return nil, output, nil
}

func mergedEdit(task vikunja.Task, input editInput, location *time.Location) (service.EditTaskInput, error) {
	if input.PlanningWindow != nil && (input.StartAt != nil || input.EndAt != nil) {
		return service.EditTaskInput{}, errorsForTool("Use planningWindow or startAt/endAt, not both.")
	}
	var rule *service.RecurringInput
	if input.Recurrence == nil && !slices.Contains(input.Clear, repairRecurrence) {
		var err error
		rule, err = nativeRule(task)
		if err != nil {
			return service.EditTaskInput{}, err
		}
	}
	edit := service.EditTaskInput{TaskID: task.ID, ExpectedVersion: input.ExpectedVersion,
		PreserveDates: preservedEditDates(input),
		Title:         task.Title, Description: task.Description, ProjectID: task.ProjectID, Priority: task.Priority,
		Job: service.ClassifyTask(task).Kind == service.TaskKindJob, Recurrence: rule,
		LabelIDs: input.LabelIDs, Reminders: reminderInputs(input.Reminders), Planning: planningInput(input.PlanningWindow)}
	if !task.DueDate.IsZero() {
		edit.DueDate = task.DueDate.In(location).Format(time.DateOnly)
		if !service.ClassifyTask(task).DateOnly {
			edit.DueTime = task.DueDate.In(location).Format("15:04")
		}
	}
	if !task.StartDate.IsZero() {
		edit.StartLocal = task.StartDate.In(location).Format("2006-01-02T15:04")
	}
	if !task.EndDate.IsZero() {
		edit.EndLocal = task.EndDate.In(location).Format("2006-01-02T15:04")
	}
	applyEditFields(&edit, input)
	if input.Recurrence != nil {
		rule := input.Recurrence
		edit.Recurrence = &service.RecurringInput{Interval: rule.Interval, Unit: rule.Unit,
			Mode: rule.Mode, KeepDueTime: rule.KeepDueTime}
	}
	if err := clearEditFields(&edit, input); err != nil {
		return edit, err
	}
	return edit, nil
}

func preservedEditDates(input editInput) service.EditDatePreservation {
	return service.EditDatePreservation{
		Due:   input.DueDate == nil && input.DueTime == nil && !slices.Contains(input.Clear, "deadline"),
		Start: input.PlanningWindow == nil && input.StartAt == nil && !slices.Contains(input.Clear, "startAt"),
		End:   input.PlanningWindow == nil && input.EndAt == nil && !slices.Contains(input.Clear, "endAt")}
}

func applyEditFields(edit *service.EditTaskInput, input editInput) {
	if input.Title != nil {
		edit.Title = *input.Title
	}
	if input.DescriptionHTML != nil {
		edit.Description = *input.DescriptionHTML
	}
	if input.ProjectID != nil {
		edit.ProjectID = *input.ProjectID
	}
	if input.Priority != nil {
		edit.Priority = *input.Priority
	}
	if input.DueDate != nil {
		edit.DueDate = *input.DueDate
	}
	if input.DueTime != nil {
		edit.DueTime = *input.DueTime
	}
	if input.StartAt != nil {
		edit.StartLocal = *input.StartAt
	}
	if input.EndAt != nil {
		edit.EndLocal = *input.EndAt
	}
}

func clearEditFields(edit *service.EditTaskInput, input editInput) error {
	for _, field := range input.Clear {
		switch field {
		case "deadline":
			if input.DueDate != nil || input.DueTime != nil {
				return errorsForTool("Cannot set and clear deadline together.")
			}
			edit.DueDate, edit.DueTime = "", ""
		case "startAt":
			if input.StartAt != nil || input.PlanningWindow != nil {
				return errorsForTool("Cannot set and clear start together.")
			}
			edit.StartLocal = ""
		case "endAt":
			if input.EndAt != nil || input.PlanningWindow != nil {
				return errorsForTool("Cannot set and clear finish together.")
			}
			edit.EndLocal = ""
		case repairRecurrence:
			if input.Recurrence != nil {
				return errorsForTool("Cannot set and clear recurrence together.")
			}
			edit.Recurrence = nil
		default:
			return errorsForTool("Unknown clear field; use deadline, startAt, endAt or recurrence.")
		}
	}
	return nil
}

func nativeRule(task vikunja.Task) (*service.RecurringInput, error) {
	const daySeconds = 86400
	if task.RepeatAfter == 0 && task.RepeatMode == 0 {
		return nil, nil
	}
	rule := &service.RecurringInput{Mode: service.RecurrenceModeScheduled,
		KeepDueTime: service.ClassifyTask(task).FixedDueTime}
	if task.RepeatMode == vikunja.RepeatModeMonthly {
		rule.Interval, rule.Unit = 1, service.RecurrenceUnitMonth
		return rule, nil
	}
	if task.RepeatAfter <= 0 || task.RepeatAfter%daySeconds != 0 ||
		(task.RepeatMode != vikunja.RepeatModeScheduled && task.RepeatMode != vikunja.RepeatModeFromCompletion) {
		return nil, errorsForTool("Native recurrence cannot be represented by this editor; no changes made.")
	}
	rule.Interval, rule.Unit = int(task.RepeatAfter/daySeconds), service.RecurrenceUnitDay
	if rule.Interval%7 == 0 {
		rule.Interval /= 7
		rule.Unit = service.RecurrenceUnitWeek
	}
	if task.RepeatMode == vikunja.RepeatModeFromCompletion {
		rule.Mode = service.RecurrenceModeFromCompletion
	}
	return rule, nil
}
