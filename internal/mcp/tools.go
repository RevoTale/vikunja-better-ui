package mcp

import (
	"context"
	"fmt"
	"reflect"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/google/jsonschema-go/jsonschema"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	statusConfirmed  = "CONFIRMED"
	statusRepair     = "REPAIR_REQUIRED"
	repairMarkers    = "markers"
	repairRecurrence = "recurrence"
	ascending        = "asc"
	maxTextRunes     = 8000
	maxMetadataItems = 100
)

func addTool[In, Out any](server *sdk.Server, tool *sdk.Tool, action func(
	context.Context, *sdk.CallToolRequest, In) (*sdk.CallToolResult, Out, error),
) {
	schema, err := jsonschema.For[In](&jsonschema.ForOptions{TypeSchemas: map[reflect.Type]*jsonschema.Schema{
		reflect.TypeFor[service.TaskScope](): stringChoices("RECURRING", "TODAY", "ACTIVE", "PERIOD", "WEEK", "MONTH",
			"JOBS", "COMPLETED_JOBS", "ALL_JOBS", "UNSCHEDULED", "LONG_TERM", "HISTORY"),
		reflect.TypeFor[service.ActiveWorkSort](): stringChoices(
			"END_ASC", "END_DESC", "START_ASC", "START_DESC", "LABEL_ASC", "LABEL_DESC"),
		reflect.TypeFor[service.RecurrenceUnit](): stringChoices("DAY", "WEEK", "MONTH"),
		reflect.TypeFor[service.RecurrenceMode](): stringChoices("FROM_COMPLETION", "SCHEDULED_CYCLE"),
		reflect.TypeFor[service.JobSort]():        stringChoices("startAt", "finishAt"),
		reflect.TypeFor[service.SortOrder]():      stringChoices("asc", "desc"),
	}})
	if err != nil {
		panic(fmt.Sprintf("invalid MCP input schema for %s: %v", tool.Name, err))
	}
	tool.InputSchema = schema
	sdk.AddTool(server, tool, func(ctx context.Context, req *sdk.CallToolRequest, input In) (
		*sdk.CallToolResult, Out, error,
	) {
		c, callerErr := requestCaller(ctx)
		if callerErr != nil {
			var zero Out
			return nil, zero, callerErr
		}
		bounded, cancel := context.WithCancel(ctx)
		// Older SDK protocol paths detach HTTP cancellation; retain the original request lifetime.
		stop := c.onRequestEnd(cancel)
		defer stop()
		defer cancel()
		return action(bounded, req, input)
	})
}

func stringChoices(values ...string) *jsonschema.Schema {
	options := make([]any, len(values))
	for i, value := range values {
		options[i] = value
	}
	return &jsonschema.Schema{Type: "string", Enum: options}
}
