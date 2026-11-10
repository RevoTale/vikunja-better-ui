package mcp

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	activityRecent  = "RECENT"
	activityAllTime = "ALL_TIME"
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

// activityTimezoneClient supplies the resolved request-local profile to shared activity services.
type activityTimezoneClient struct {
	*vikunja.Client

	user vikunja.User
}

func (client activityTimezoneClient) CurrentUser(ctx context.Context) (vikunja.User, error) {
	return client.user, ctx.Err()
}

func getActivity(ctx context.Context, _ *sdk.CallToolRequest, input activityInput) (
	*sdk.CallToolResult, activityOutput, error,
) {
	if input.Period != "" && input.Period != activityRecent && input.Period != activityAllTime {
		return nil, activityOutput{}, errorsForTool("Use period RECENT or ALL_TIME.")
	}
	c, user, _, err := taskContext(ctx)
	if err != nil {
		return nil, activityOutput{}, err
	}
	now := func() time.Time { return c.now }
	client := activityTimezoneClient{Client: c.client, user: user}
	output := activityOutput{Period: input.Period,
		Note: "Counts completions visible to this token, not effort or future obligations."}
	switch input.Period {
	case "", activityRecent:
		summary, readErr := service.NewCurrentActivity(client, now).Read(ctx)
		if readErr != nil {
			return nil, activityOutput{}, errorsForTool("Activity could not be fully read; this is not zero activity.")
		}
		output.Period, output.Timezone, output.GeneratedAt = activityRecent, summary.Timezone, summary.GeneratedAt
		output.Total, output.Priorities = summary.Total, summary.Priorities
		for _, day := range summary.Days {
			output.Days = append(output.Days, activityDay{
				Date: day.Date, Completed: day.Count, WithDeadline: day.WithDeadlineCount, OnTime: day.OnTimeCount})
		}
	case activityAllTime:
		summary, readErr := service.NewCurrentAllTimeActivity(client, now).Read(ctx)
		if readErr != nil {
			return nil, activityOutput{}, errorsForTool("All-time activity could not be fully read; narrow to RECENT.")
		}
		output.Timezone, output.GeneratedAt = summary.Timezone, summary.GeneratedAt
		output.Total, output.Priorities = summary.Total, summary.Priorities
	}
	return nil, output, nil
}
