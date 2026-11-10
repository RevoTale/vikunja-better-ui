package mcp

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	timezoneVikunja     = "VIKUNJA"
	timezoneBotFallback = "BOT_FALLBACK"
	timezoneUnavailable = "UNAVAILABLE"
)

type contextInput struct {
	Page int `json:"page,omitempty" jsonschema:"One-based catalogue page; default 1, 30 items per catalogue"`
}
type projectSummary struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
}
type contextOutput struct {
	Timezone        string           `json:"timezone"`
	TimezoneSource  string           `json:"timezoneSource"  jsonschema:"VIKUNJA or BOT_FALLBACK or UNAVAILABLE"`
	SchedulingReady bool             `json:"schedulingReady"`
	Now             time.Time        `json:"now"`
	WeekStart       int              `json:"weekStart"`
	Projects        []projectSummary `json:"projects"`
	Labels          []labelSummary   `json:"labels"`
	Page            int              `json:"page"`
	ProjectsHasMore bool             `json:"projectsHasMore"`
	LabelsHasMore   bool             `json:"labelsHasMore"`
}

func getContext(ctx context.Context, _ *sdk.CallToolRequest, input contextInput) (
	*sdk.CallToolResult, contextOutput, error,
) {
	if input.Page == 0 {
		input.Page = 1
	}
	if input.Page < 1 || input.Page > 1000 {
		return nil, contextOutput{}, errorsForTool("Use page between 1 and 1000.")
	}
	c, user, source, err := userContext(ctx)
	if err != nil {
		return nil, contextOutput{}, err
	}
	projects, err := c.client.Projects(ctx)
	if err != nil {
		return nil, contextOutput{}, errorsForTool("Projects could not be read; check permissions.")
	}
	labels, err := c.client.Labels(ctx)
	if err != nil {
		return nil, contextOutput{}, errorsForTool("Labels could not be read; check permissions.")
	}
	output := contextOutput{Timezone: user.Settings.Timezone, Now: c.now, WeekStart: user.Settings.WeekStart,
		TimezoneSource: source,
		Page:           input.Page, Projects: []projectSummary{}, Labels: []labelSummary{}}
	_, zoneErr := time.LoadLocation(user.Settings.Timezone)
	output.SchedulingReady = user.Settings.Timezone != "" && zoneErr == nil
	start := (input.Page - 1) * defaultPageSize
	for i := start; i < len(projects) && i < start+defaultPageSize; i++ {
		output.Projects = append(output.Projects, projectSummary{ID: projects[i].ID, Title: projects[i].Title})
	}
	ordinary := make([]labelSummary, 0, len(labels))
	for _, label := range labels {
		if !service.IsInternalLabel(label.Title) {
			ordinary = append(ordinary, labelSummary{ID: label.ID, Title: label.Title})
		}
	}
	if start < len(ordinary) {
		output.Labels = ordinary[start:min(start+defaultPageSize, len(ordinary))]
	}
	output.ProjectsHasMore = start+defaultPageSize < len(projects)
	output.LabelsHasMore = start+defaultPageSize < len(ordinary)
	return nil, output, nil
}
