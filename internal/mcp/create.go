package mcp

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

type createBase struct {
	Title       string          `json:"title"`
	ProjectID   int64           `json:"projectId"`
	Description string          `json:"description,omitempty" jsonschema:"Markdown, converted by Vikunja"`
	Priority    int64           `json:"priority,omitempty"    jsonschema:"Native priority 0 through 5"`
	LabelIDs    []int64         `json:"labelIds,omitempty"`
	Reminders   []reminderInput `json:"reminders,omitempty"`
}

type reminderInput struct {
	At             *time.Time `json:"at,omitempty"`
	LocalAt        string     `json:"localAt,omitempty"`
	RelativeTo     string     `json:"relativeTo,omitempty"     jsonschema:"start_date, end_date, due_date or empty"`
	RelativePeriod int64      `json:"relativePeriod,omitempty" jsonschema:"Signed seconds; -7200 is two hours before"`
}

type windowInput struct {
	StartsOn     string `json:"startsOn"`
	EndsOn       string `json:"endsOn"`
	StartsAtTime string `json:"startsAtTime,omitempty"`
	EndsAtTime   string `json:"endsAtTime,omitempty"`
}

type oneTimeInput struct {
	createBase

	DueDate        string       `json:"dueDate,omitempty"`
	DueTime        string       `json:"dueTime,omitempty"`
	PlanningWindow *windowInput `json:"planningWindow,omitempty"`
	StartNow       bool         `json:"startNow,omitempty"`
}

type recurringInput struct {
	createBase

	FirstDueDate      string          `json:"firstDueDate"`
	DueTime           string          `json:"dueTime,omitempty"`
	AvailableFrom     string          `json:"availableFrom,omitempty"`
	AvailableFromTime string          `json:"availableFromTime,omitempty"`
	Rule              recurrenceInput `json:"rule"`
	StartNow          bool            `json:"startNow,omitempty"`
}

type recurrenceInput struct {
	Interval    int                    `json:"interval"`
	Unit        service.RecurrenceUnit `json:"unit"                  jsonschema:"DAY, WEEK or MONTH"`
	Mode        service.RecurrenceMode `json:"mode"                  jsonschema:"FROM_COMPLETION or SCHEDULED_CYCLE"`
	KeepDueTime bool                   `json:"keepDueTime,omitempty"`
}

type jobInput struct {
	createBase

	StartAt                 string           `json:"startAt"                 jsonschema:"Local YYYY-MM-DDTHH:mm"`
	DurationMinutes         int              `json:"durationMinutes"`
	CompletionWindowMinutes int              `json:"completionWindowMinutes"`
	Rule                    *recurrenceInput `json:"rule,omitempty"`
}

type mutationOutput struct {
	Task             taskReference `json:"task"`
	Status           string        `json:"status"`
	RepairCapability string        `json:"repairCapability,omitempty"`
	RepairKind       string        `json:"repairKind,omitempty"`
	Warning          string        `json:"warning,omitempty"`
}

func createOneTime(ctx context.Context, _ *sdk.CallToolRequest, input oneTimeInput) (
	*sdk.CallToolResult, mutationOutput, error,
) {
	c, user, location, err := taskContext(ctx)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	write, dateOnly, err := service.BuildOneTimeTask(service.OneTimeInput{Title: input.Title,
		Description: input.Description, Priority: input.Priority, DueDate: input.DueDate, DueTime: input.DueTime,
		Planning: planningInput(input.PlanningWindow)}, location)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	if input.StartNow {
		service.ApplyCreationStartNow(&write, c.now)
	}
	markers := []string{}
	if dateOnly {
		markers = append(markers, "vbu:date-only")
	}
	return saveCreated(ctx, c, user, location, input.createBase, write, markers)
}

func createRecurring(ctx context.Context, _ *sdk.CallToolRequest, input recurringInput) (
	*sdk.CallToolResult, mutationOutput, error,
) {
	c, user, location, err := taskContext(ctx)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	rule := input.Rule
	write, dateOnly, err := service.BuildRecurringTask(service.RecurringInput{Title: input.Title,
		Description: input.Description, Priority: input.Priority, FirstDueDate: input.FirstDueDate,
		DueTime: input.DueTime, AvailableFrom: input.AvailableFrom, AvailableFromTime: input.AvailableFromTime,
		Interval: rule.Interval, Unit: rule.Unit, Mode: rule.Mode, KeepDueTime: rule.KeepDueTime}, location)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	if input.StartNow {
		service.ApplyCreationStartNow(&write, c.now)
	}
	markers := []string{}
	if dateOnly {
		markers = append(markers, "vbu:date-only")
	}
	if rule.KeepDueTime {
		markers = append(markers, "vbu:fixed-due-time")
	}
	if input.AvailableFrom != "" {
		markers = append(markers, "vbu:recurring-availability")
	}
	return saveCreated(ctx, c, user, location, input.createBase, write, markers)
}

func createJob(ctx context.Context, _ *sdk.CallToolRequest, input jobInput) (
	*sdk.CallToolResult, mutationOutput, error,
) {
	c, user, location, err := taskContext(ctx)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	job := service.JobInput{Title: input.Title, Description: input.Description, Priority: input.Priority,
		StartLocal: input.StartAt, DurationMinutes: input.DurationMinutes,
		CompletionWindowMinutes: input.CompletionWindowMinutes}
	markers := []string{"vbu:job"}
	if input.Rule != nil {
		job.Interval, job.Unit, job.Mode = input.Rule.Interval, input.Rule.Unit, input.Rule.Mode
		job.KeepDueTime = input.Rule.KeepDueTime
		if job.KeepDueTime {
			markers = append(markers, "vbu:fixed-due-time")
		}
	}
	write, err := service.BuildJobTask(job, location)
	if err != nil {
		return nil, mutationOutput{}, err
	}
	return saveCreated(ctx, c, user, location, input.createBase, write, markers)
}

func planningInput(input *windowInput) *service.PlanningWindowInput {
	if input == nil {
		return nil
	}
	return &service.PlanningWindowInput{StartsOn: input.StartsOn, EndsOn: input.EndsOn,
		StartsAtTime: input.StartsAtTime, EndsAtTime: input.EndsAtTime}
}

func reminderInputs(inputs []reminderInput) []service.ReminderInput {
	if inputs == nil {
		return nil
	}
	result := make([]service.ReminderInput, 0, len(inputs))
	for _, input := range inputs {
		result = append(result, service.ReminderInput{At: input.At,
			LocalAt: input.LocalAt, RelativeTo: input.RelativeTo, RelativePeriod: input.RelativePeriod})
	}
	return result
}
