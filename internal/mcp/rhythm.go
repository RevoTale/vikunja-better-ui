package mcp

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

type rhythmInput struct {
	Period    string `json:"period,omitempty"    jsonschema:"WEEK (default), MONTH or YEAR; normalized frequency"`
	ProjectID *int64 `json:"projectId,omitempty"`
	LabelID   *int64 `json:"labelId,omitempty"`
	Page      int    `json:"page,omitempty"`
}
type rhythmItem struct {
	Task      taskSummary      `json:"task"`
	Rule      *recurrenceInput `json:"rule,omitempty"`
	Frequency string           `json:"frequency"`
}
type rhythmOutput struct {
	Period   string       `json:"period"`
	Timezone string       `json:"timezone"`
	Items    []rhythmItem `json:"items"`
	Page     int          `json:"page"`
	HasMore  bool         `json:"hasMore"`
	Complete bool         `json:"complete"`
	Note     string       `json:"note"`
}

func getRecurringOverview(ctx context.Context, _ *sdk.CallToolRequest, input rhythmInput) (
	*sdk.CallToolResult, rhythmOutput, error,
) {
	if input.Period == "" {
		input.Period = "WEEK"
	}
	if input.Period != "WEEK" && input.Period != "MONTH" && input.Period != "YEAR" {
		return nil, rhythmOutput{}, errorsForTool("Use period WEEK, MONTH or YEAR.")
	}
	c, user, location, err := taskContext(ctx)
	if err != nil {
		return nil, rhythmOutput{}, err
	}
	list := listInput{Scope: service.TaskScopeRecurring, ProjectID: input.ProjectID, LabelID: input.LabelID,
		Page: input.Page}
	request, err := listRequest(list, c.now, user, location)
	if err != nil {
		return nil, rhythmOutput{}, err
	}
	if err := listMetadata(ctx, c.client, list, &request); err != nil {
		return nil, rhythmOutput{}, err
	}
	result, err := service.ListTasks(ctx, c.client, request)
	if err != nil {
		return nil, rhythmOutput{}, errorsForTool("Recurring overview could not be read.")
	}
	output := rhythmOutput{Period: input.Period, Timezone: user.Settings.Timezone, Page: result.Page,
		HasMore: result.HasMore, Complete: result.IsComplete, Items: []rhythmItem{},
		Note: "Frequency is a normalized rhythm, not an exact occurrence count. " +
			"Completion-relative schedules depend on when you finish."}
	for _, item := range result.Items {
		rule := semanticRule(item.Task)
		output.Items = append(output.Items, rhythmItem{Task: summarize(item.Task, c.now), Rule: rule,
			Frequency: rhythmFrequency(rule, input.Period)})
	}
	return nil, output, nil
}

func rhythmFrequency(rule *recurrenceInput, period string) string {
	if rule == nil {
		return "Frequency unavailable"
	}
	return service.RecurringFrequency(rule.Interval, rule.Unit, period)
}
