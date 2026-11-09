package mcp

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

func saveCreated(
	ctx context.Context, c *caller, user vikunja.User, location *time.Location,
	input createBase, write vikunja.TaskWrite, markers []string,
) (*sdk.CallToolResult, mutationOutput, error) {
	if input.Priority < 0 || input.Priority > 5 {
		return nil, mutationOutput{}, errorsForTool("Priority must be 0 through 5.")
	}
	if err := checkProject(ctx, c.client, input.ProjectID); err != nil {
		return nil, mutationOutput{}, err
	}
	reminders, err := service.BuildReminders(reminderInputs(input.Reminders), write, location)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	write.Reminders = reminders
	result, err := service.CreateLabeledTask(ctx, c.client, input.ProjectID, write, markers, input.LabelIDs)
	if err != nil {
		return nil, mutationOutput{}, errorsForTool("Creation could not be confirmed. Read current tasks before retrying.")
	}
	output := mutationOutput{Task: mutationDetail(result.Task, user.Settings.Timezone, c), Status: statusConfirmed}
	if result.LabelError != nil {
		output.Status = "PARTIAL"
		output.Warning = "Task exists; ordinary labels could not be confirmed. Reload before editing."
	}
	links := c.linker.Saved(ctx, result.Task.ID, "", result.Task.Description)
	if len(links.FailedIDs) > 0 || links.Limited {
		output.Warning += " Some content reference links were not confirmed."
	}
	if result.RepairRequired {
		createdRepair(ctx, c, result, &output)
	}
	refreshMutation(ctx, c, user, &output)
	return nil, output, nil
}

func refreshMutation(ctx context.Context, c *caller, user vikunja.User, output *mutationOutput) {
	task, _, err := c.client.Task(ctx, output.Task.Task.ID)
	if err != nil {
		output.Task.Version = ""
		output.Warning += " Saved task could not be reloaded. Read it before further edits; do not recreate."
		return
	}
	output.Task = mutationDetail(task, user.Settings.Timezone, c)
}

func createdRepair(ctx context.Context, c *caller, result service.CreationResult, output *mutationOutput) {
	output.Status = statusRepair
	task, metadata, err := c.client.Task(ctx, result.Task.ID)
	if err != nil {
		output.Warning += " Task exists but recovery could not be authorized. Reload; do not recreate."
		return
	}
	capability, err := c.capabilities.IssueMarkerRepair(c.principal, service.MarkerRepairGrant{
		TaskID: task.ID, MarkerTitles: result.MissingMarkers, ETag: metadata.ETag})
	if err != nil {
		output.Warning += " Recovery could not be authorized. Do not recreate."
		return
	}
	output.RepairCapability, output.RepairKind = capability, repairMarkers
}

func addCreateTools(server *sdk.Server) {
	addTool(server, writeTool("update_task", "Edit delegated fields with expectedVersion. Omitted/null preserves; "+
		"use clear for dates/recurrence and [] to clear labels/reminders. Never shift unrelated dates."), updateTask)
	addTool(server, writeTool("create_one_time_task",
		"Create explicitly requested one-time work. Plan window is availability, not duration; due is a separate deadline."),
		createOneTime)
	addTool(server, writeTool("create_recurring_task",
		"Create a recurring series with a first due date and optional availability. Native rule limitations apply."),
		createRecurring)
	addTool(server, writeTool("create_job",
		"Create a timed session. Positive duration plus positive completion buffer; recurrence optional."),
		createJob)
}

func writeTool(name, description string) *sdk.Tool {
	destructive := true
	switch name {
	case "create_one_time_task", "create_recurring_task", "create_job", "create_subtask", "create_label", "create_comment":
		destructive = false
	}
	return &sdk.Tool{Name: name, Description: description + " Only when the user requests this change.",
		Annotations: &sdk.ToolAnnotations{ReadOnlyHint: false, DestructiveHint: &destructive}}
}
