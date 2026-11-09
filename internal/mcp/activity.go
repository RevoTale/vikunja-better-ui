package mcp

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

type activityInput struct {
	Period string `json:"period,omitempty" jsonschema:"RECENT (14 local days, default) or ALL_TIME"`
}
type activityOutput struct {
	Period      string        `json:"period"`
	Timezone    string        `json:"timezone"`
	GeneratedAt time.Time     `json:"generatedAt"`
	Total       int           `json:"total"`
	Priorities  [6]int        `json:"priorities"`
	Days        []activityDay `json:"days,omitempty"`
	Note        string        `json:"note"`
}
type activityDay struct {
	Date         string `json:"date"`
	Completed    int    `json:"completed"`
	WithDeadline int    `json:"withDeadline"`
	OnTime       int    `json:"onTime"`
}

func getActivity(ctx context.Context, _ *sdk.CallToolRequest, input activityInput) (
	*sdk.CallToolResult, activityOutput, error,
) {
	c, err := requestCaller(ctx)
	if err != nil {
		return nil, activityOutput{}, err
	}
	now := func() time.Time { return c.now }
	output := activityOutput{Period: input.Period,
		Note: "Counts completions visible to this token, not effort or future obligations."}
	switch input.Period {
	case "", "RECENT":
		summary, readErr := service.NewCurrentActivity(c.client, now).Read(ctx)
		if readErr != nil {
			return nil, activityOutput{}, errorsForTool("Activity could not be fully read; this is not zero activity.")
		}
		output.Period, output.Timezone, output.GeneratedAt = "RECENT", summary.Timezone, summary.GeneratedAt
		output.Total, output.Priorities = summary.Total, summary.Priorities
		for _, day := range summary.Days {
			output.Days = append(output.Days, activityDay{
				Date: day.Date, Completed: day.Count, WithDeadline: day.WithDeadlineCount, OnTime: day.OnTimeCount})
		}
	case "ALL_TIME":
		summary, readErr := service.NewCurrentAllTimeActivity(c.client, now).Read(ctx)
		if readErr != nil {
			return nil, activityOutput{}, errorsForTool("All-time activity could not be fully read; narrow to RECENT.")
		}
		output.Timezone, output.GeneratedAt = summary.Timezone, summary.GeneratedAt
		output.Total, output.Priorities = summary.Total, summary.Priorities
	default:
		return nil, activityOutput{}, errorsForTool("Use period RECENT or ALL_TIME.")
	}
	return nil, output, nil
}
