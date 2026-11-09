package mcp

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

type completionInput struct {
	TaskID        int64      `json:"taskId"`
	ExpectedDueAt *time.Time `json:"expectedDueAt,omitempty" jsonschema:"Occurrence deadline; required for recurrence"`
}

type completionOutput struct {
	Mutation       mutationOutput `json:"mutation"`
	HistoryTaskID  int64          `json:"historyTaskId,omitempty"`
	UndoCapability string         `json:"undoCapability,omitempty"`
	UndoUntil      *time.Time     `json:"undoUntil,omitempty"`
}

type recoveryInput struct {
	Capability string `json:"capability"`
	Kind       string `json:"kind,omitempty" jsonschema:"For repair: markers or recurrence; omit for undo"`
}

func completeTask(ctx context.Context, _ *sdk.CallToolRequest, input completionInput) (
	*sdk.CallToolResult, completionOutput, error,
) {
	return finishTask(ctx, input, false)
}

func skipOccurrence(ctx context.Context, _ *sdk.CallToolRequest, input completionInput) (
	*sdk.CallToolResult, completionOutput, error,
) {
	return finishTask(ctx, input, true)
}

func finishTask(ctx context.Context, input completionInput, skip bool) (*sdk.CallToolResult, completionOutput, error) {
	c, user, location, err := taskContext(ctx)
	if err != nil {
		return nil, completionOutput{}, err
	}
	task, _, err := c.client.Task(ctx, input.TaskID)
	if err != nil {
		return nil, completionOutput{}, errorsForTool("Task could not be read; check taskId and permissions.")
	}
	classification := service.ClassifyTask(task)
	if classification.Recurring {
		if input.ExpectedDueAt == nil || input.ExpectedDueAt.IsZero() {
			return nil, completionOutput{}, errorsForTool("Read the current occurrence and supply expectedDueAt.")
		}
		action := service.CompleteRecurring
		if skip {
			action = service.SkipRecurring
		}
		result, actionErr := action(ctx, c.client, c.capabilities, task.ID, *input.ExpectedDueAt, location)
		if actionErr != nil {
			return nil, completionOutput{}, uncertainWrite("Completion/skip", actionErr)
		}
		return nil, recurringResult(c, user, result), nil
	}
	if skip {
		return nil, completionOutput{}, errorsForTool("Only recurring occurrences can be skipped.")
	}
	result, err := service.CompleteNonRecurring(ctx, c.client, c.capabilities, c.principal, task.ID, classification.Kind)
	if err != nil {
		return nil, completionOutput{}, uncertainWrite("Completion", err)
	}
	return nil, completionOutput{Mutation: mutationOutput{Task: mutationDetail(result.Task, user.Settings.Timezone, c),
		Status: statusConfirmed}, UndoCapability: result.UndoCapability, UndoUntil: &result.UndoUntil}, nil
}

func recurringResult(c *caller, user vikunja.User, result service.RecurringCompletion) completionOutput {
	output := completionOutput{Mutation: mutationOutput{Task: mutationDetail(result.LiveTask, user.Settings.Timezone, c),
		Status: statusConfirmed}, HistoryTaskID: result.Snapshot.ID}
	if result.RepairRequired {
		output.Mutation.Status = statusRepair
		output.Mutation.RepairKind = repairRecurrence
		capability, err := c.capabilities.IssueRecurringRepair(c.principal, result.RepairGrant)
		if err != nil {
			output.Mutation.Warning = "Renewal happened; recovery unavailable. Do not complete again."
		} else {
			output.Mutation.RepairCapability = capability
		}
	}
	return output
}

func undoCompletion(ctx context.Context, _ *sdk.CallToolRequest, input recoveryInput) (
	*sdk.CallToolResult, mutationOutput, error,
) {
	c, user, _, err := taskContext(ctx)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	task, err := service.UndoNonRecurring(ctx, c.client, c.capabilities, c.principal, input.Capability)
	if err != nil {
		return nil, mutationOutput{}, uncertainWrite("Undo", err)
	}
	return nil, mutationOutput{Task: mutationDetail(task, user.Settings.Timezone, c), Status: statusConfirmed}, nil
}

func repairTask(ctx context.Context, _ *sdk.CallToolRequest, input recoveryInput) (
	*sdk.CallToolResult, completionOutput, error,
) {
	c, user, _, err := taskContext(ctx)
	if err != nil {
		return nil, completionOutput{}, err
	}
	switch input.Kind {
	case repairMarkers:
		result, repairErr := service.RepairMarker(ctx, c.client, c.capabilities, c.principal, input.Capability)
		if repairErr != nil {
			return nil, completionOutput{}, uncertainWrite("Marker repair", repairErr)
		}
		output := mutationOutput{Task: mutationDetail(result.Task, user.Settings.Timezone, c), Status: statusConfirmed}
		if !result.Complete {
			output.Status, output.RepairKind, output.RepairCapability = statusRepair, repairMarkers, result.Capability
		}
		return nil, completionOutput{Mutation: output}, nil
	case repairRecurrence:
		grant, grantErr := c.capabilities.ParseRecurringRepair(c.principal, input.Capability)
		if grantErr != nil {
			return nil, completionOutput{}, errorsForTool("Recovery capability is invalid or expired for this caller.")
		}
		result, repairErr := service.RepairRecurringSnapshot(ctx, c.client, grant)
		if repairErr != nil {
			return nil, completionOutput{}, uncertainWrite("Recurrence repair", repairErr)
		}
		return nil, recurringResult(c, user, result), nil
	default:
		return nil, completionOutput{}, errorsForTool("Use the returned repair kind: markers or recurrence.")
	}
}

func addLifecycleTools(server *sdk.Server) {
	addTool(server, writeTool("complete_task",
		"Complete requested work. Recurrence needs current expectedDueAt; renews and archives "+
			"once. Read before retrying."), completeTask)
	addTool(server, writeTool("skip_occurrence",
		"Skip only the displayed recurring occurrence using expectedDueAt; advances series "+
			"with skipped history, no Undo."), skipOccurrence)
	addTool(server, writeTool("undo_completion",
		"Undo a non-recurring completion using its unexpired caller-bound capability."), undoCompletion)
	addTool(server, writeTool("repair_task",
		"Finish previously authorized partial work using its returned kind and capability; "+
			"never repeat completion."), repairTask)
}
