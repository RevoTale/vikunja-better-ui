package mcp

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

type relationInput struct {
	TaskID      int64                `json:"taskId"`
	OtherTaskID int64                `json:"otherTaskId"`
	Kind        vikunja.RelationKind `json:"kind"             jsonschema:"related/subtask; parenttask removal only"`
	Remove      bool                 `json:"remove,omitempty"`
}
type actionOutput struct {
	TaskID int64  `json:"taskId,omitempty"`
	Title  string `json:"title,omitempty"`
	Status string `json:"status"`
}
type subtaskInput struct {
	ParentID  int64   `json:"parentId"`
	Title     string  `json:"title"`
	ProjectID *int64  `json:"projectId,omitempty"`
	Priority  *int64  `json:"priority,omitempty"`
	LabelIDs  []int64 `json:"labelIds,omitempty"  jsonschema:"Omit to inherit ordinary labels; [] clears"`
}
type deleteInput struct {
	TaskID          int64  `json:"taskId"`
	ExpectedVersion string `json:"expectedVersion"`
}
type labelInput struct {
	Title string `json:"title"`
}

func setTaskRelation(ctx context.Context, _ *sdk.CallToolRequest, input relationInput) (
	*sdk.CallToolResult, actionOutput, error,
) {
	c, err := requestCaller(ctx)
	if err != nil {
		return nil, actionOutput{}, err
	}
	if err := service.SetTaskRelation(ctx, c.client, c.client,
		input.TaskID, input.OtherTaskID, input.Kind, input.Remove); err != nil {
		return nil, actionOutput{}, uncertainWrite("Relation change", err)
	}
	return nil, actionOutput{TaskID: input.TaskID, Status: statusConfirmed}, nil
}

func createSubtask(ctx context.Context, _ *sdk.CallToolRequest, input subtaskInput) (
	*sdk.CallToolResult, mutationOutput, error,
) {
	c, user, _, err := taskContext(ctx)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	result, err := service.CreateSubtask(ctx, c.client, c.client, input.ParentID, service.SubtaskInput{
		Title: input.Title, ProjectID: input.ProjectID, Priority: input.Priority, LabelIDs: input.LabelIDs})
	if err != nil {
		return nil, mutationOutput{}, uncertainWrite("Subtask creation", err)
	}
	output := mutationOutput{Task: mutationDetail(result.Creation.Task, user.Settings.Timezone, c),
		Status: statusConfirmed}
	if result.Creation.LabelError != nil || result.RelationError != nil {
		output.Status = "PARTIAL"
		output.Warning = "Child exists but labels or parent link were not confirmed. Reload; do not recreate."
	}
	refreshMutation(ctx, c, user, &output)
	return nil, output, nil
}

func deleteTask(ctx context.Context, _ *sdk.CallToolRequest, input deleteInput) (
	*sdk.CallToolResult, actionOutput, error,
) {
	c, err := requestCaller(ctx)
	if err != nil {
		return nil, actionOutput{}, err
	}
	task, _, err := c.client.Task(ctx, input.TaskID)
	if err != nil {
		return nil, actionOutput{}, errorsForTool("Read the task before deleting it.")
	}
	if input.ExpectedVersion == "" || service.TaskVersion(task) != input.ExpectedVersion {
		return nil, actionOutput{}, errorsForTool("CONFLICT: reload and confirm the task to delete.")
	}
	projects, err := c.client.Projects(ctx)
	if err != nil {
		return nil, actionOutput{}, errorsForTool("Project access could not be checked.")
	}
	ids := make([]int64, 0, len(projects))
	for _, project := range projects {
		ids = append(ids, project.ID)
	}
	if err := service.DeleteActiveTask(ctx, c.client, task.ID, ids); err != nil {
		return nil, actionOutput{}, uncertainWrite("Deletion", err)
	}
	return nil, actionOutput{TaskID: task.ID, Title: task.Title, Status: "DELETED"}, nil
}

func createLabel(ctx context.Context, _ *sdk.CallToolRequest, input labelInput) (
	*sdk.CallToolResult, labelSummary, error,
) {
	c, err := requestCaller(ctx)
	if err != nil {
		return nil, labelSummary{}, err
	}
	label, err := service.ResolveUserLabel(ctx, c.client, input.Title)
	if err != nil {
		return nil, labelSummary{}, uncertainWrite("Label creation", err)
	}
	return nil, labelSummary{ID: label.ID, Title: label.Title}, nil
}

func addRelationTools(server *sdk.Server) {
	addTool(server, writeTool("set_task_relation",
		"Link/unlink explicit related tasks or parent-to-child subtasks; rejects cycles. Not "+
			"time containment."), setTaskRelation)
	addTool(server, writeTool("create_subtask",
		"Create one-time child, inheriting project/priority/ordinary labels unless overridden. "+
			"Partial link failure never means recreate."), createSubtask)
	addTool(server, writeTool("create_label",
		"Create or reuse an exact ordinary label title. Reserved vbu: labels cannot be created "+
			"here."), createLabel)
	addTool(server, writeTool("delete_task",
		"Delete the named active task after user confirmation and fresh get_task version. "+
			"History is protected; check then delete is not atomic."), deleteTask)
}
