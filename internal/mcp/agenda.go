package mcp

import (
	"context"
	"slices"
	"strconv"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

const maxAgendaItems = 100

type agendaInput struct {
	Date      string `json:"date,omitempty"      jsonschema:"Local YYYY-MM-DD; defaults to today"`
	ProjectID *int64 `json:"projectId,omitempty"`
	LabelID   *int64 `json:"labelId,omitempty"`
}

type agendaSection struct {
	Issue    string        `json:"issue,omitempty"`
	Items    []taskSummary `json:"items"`
	Complete bool          `json:"complete"`
	HasMore  bool          `json:"hasMore"`
}

type overlap struct {
	TaskID      int64 `json:"taskId"`
	OtherTaskID int64 `json:"otherTaskId"`
}

type projectedOccurrence struct {
	SourceTaskID int64     `json:"sourceTaskId"`
	DueAt        time.Time `json:"dueAt"`
}

type agendaOutput struct {
	Date                string                `json:"date"`
	Timezone            string                `json:"timezone"`
	Obligations         agendaSection         `json:"obligations"`
	AvailableNow        agendaSection         `json:"availableNow"`
	Sessions            agendaSection         `json:"sessions"`
	Projections         []projectedOccurrence `json:"projections"`
	ProjectionsComplete bool                  `json:"projectionsComplete"`
	ProjectionsIssue    string                `json:"projectionsIssue,omitempty"`
	Overlaps            []overlap             `json:"overlaps"`
	OverlapsComplete    bool                  `json:"overlapsComplete"`
	Note                string                `json:"note"`
}

func getAgenda(
	ctx context.Context, _ *sdk.CallToolRequest, input agendaInput,
) (*sdk.CallToolResult, agendaOutput, error) {
	c, user, location, err := taskContext(ctx)
	if err != nil {
		return nil, agendaOutput{}, err
	}
	if input.Date == "" {
		input.Date = c.now.In(location).Format(time.DateOnly)
	}
	list := listInput{Scope: service.TaskScopePeriod, From: input.Date, Through: input.Date,
		ProjectID: input.ProjectID, LabelID: input.LabelID, PageSize: maxAgendaItems}
	request, err := listRequest(list, c.now, user, location)
	if err != nil {
		return nil, agendaOutput{}, err
	}
	if err := listMetadata(ctx, c.client, list, &request); err != nil {
		return nil, agendaOutput{}, err
	}
	obligations, err := service.ListTasks(ctx, c.client, request)
	output := agendaOutput{Date: input.Date, Timezone: user.Settings.Timezone,
		Obligations: section(obligations, c.now),
		Note: "AvailableNow is optional work at the current instant, not obligations for the selected day. " +
			"Projections are not persisted tasks. Incomplete sections require narrower filters or list_tasks pagination."}
	if err != nil {
		output.Obligations = failedSection("Day obligations could not be loaded.")
	}
	fillAgenda(ctx, c, input, request, &output)
	return nil, output, nil
}

func fillAgenda(
	ctx context.Context, c *caller, input agendaInput, request service.ListRequest, output *agendaOutput,
) {
	active := request
	active.Scope, active.PeriodFrom, active.PeriodBefore = service.TaskScopeActive, time.Time{}, time.Time{}
	available, err := service.ListTasks(ctx, c.client, active)
	output.AvailableNow = section(available, c.now)
	if err != nil {
		output.AvailableNow = failedSection("Available work could not be loaded.")
	}
	output.Sessions, err = scheduledSessions(ctx, c, request)
	if err != nil {
		output.Sessions = failedSection("Sessions could not be loaded.")
	}
	output.Overlaps, output.OverlapsComplete = sessionOverlaps(output.Sessions)
	fillProjections(ctx, c, input, request, output)
}

func failedSection(issue string) agendaSection {
	return agendaSection{Items: []taskSummary{}, Issue: issue}
}

func fillProjections(
	ctx context.Context, c *caller, input agendaInput, request service.ListRequest, output *agendaOutput,
) {
	output.Projections = make([]projectedOccurrence, 0)
	day, err := service.ListDay(ctx, c.client, service.WeekRequest{Containing: request.PeriodFrom,
		Now: c.now, Location: request.Location, Timezone: request.Timezone, WeekStart: request.WeekStart,
		ProjectID: input.ProjectID, LabelIDs: request.FilterLabelIDs})
	if err != nil {
		output.ProjectionsIssue = "Recurrence projections could not be loaded."
		return
	}
	output.ProjectionsComplete = day.IsComplete
	if !day.IsComplete {
		output.ProjectionsIssue = "Projection sources are incomplete; narrow filters or resolve upstream access."
	}
	for _, date := range day.Days {
		for _, projection := range date.Projections {
			if len(output.Projections) == maxAgendaItems {
				output.ProjectionsComplete = false
				return
			}
			output.Projections = append(output.Projections, projectedOccurrence{
				SourceTaskID: projection.Source.Task.ID, DueAt: projection.DueAt})
		}
	}
}

func section(result service.ListResult, now time.Time) agendaSection {
	output := agendaSection{Items: make([]taskSummary, 0, len(result.Items)),
		Complete: result.IsComplete, HasMore: result.HasMore}
	if result.Issue != nil {
		output.Issue = string(result.Issue.Code)
	}
	for _, item := range result.Items {
		output.Items = append(output.Items, summarize(item.Task, now))
	}
	return output
}

func scheduledSessions(ctx context.Context, c *caller, request service.ListRequest) (agendaSection, error) {
	filter := "done = false && start_date < '" + request.PeriodBefore.Format(time.RFC3339) +
		"' && end_date > '" + request.PeriodFrom.Format(time.RFC3339) + "'"
	if request.ProjectID != nil {
		filter += " && project_id = " + strconv.FormatInt(*request.ProjectID, 10)
	}
	page, err := c.client.TasksPage(ctx, vikunja.TaskQuery{Page: 1, PerPage: maxAgendaItems,
		Filter: filter, FilterTimezone: request.Timezone,
		SortBy: []string{"start_date", "id"}, OrderBy: []string{ascending, ascending}})
	if err != nil {
		return agendaSection{}, errorsForTool("Scheduled sessions could not be loaded.")
	}
	output := agendaSection{Items: make([]taskSummary, 0), Complete: true, HasMore: page.TotalPages > 1}
	for _, task := range page.Items {
		if service.ClassifyTask(task).Kind != service.TaskKindJob {
			continue
		}
		if !matchesLabel(task, request.FilterLabelIDs) {
			continue
		}
		output.Items = append(output.Items, summarize(task, c.now))
	}
	return output, nil
}

func matchesLabel(task vikunja.Task, ids []int64) bool {
	if len(ids) == 0 {
		return true
	}
	for _, label := range task.Labels {
		if slices.Contains(ids, label.ID) {
			return true
		}
	}
	return false
}

func sessionOverlaps(sessions agendaSection) ([]overlap, bool) {
	result := make([]overlap, 0)
	for index, left := range sessions.Items {
		for _, right := range sessions.Items[index+1:] {
			if left.AvailableFrom == nil || left.PlannedFinish == nil ||
				right.AvailableFrom == nil || right.PlannedFinish == nil {
				continue
			}
			if left.AvailableFrom.Before(*right.PlannedFinish) && right.AvailableFrom.Before(*left.PlannedFinish) {
				if len(result) == maxAgendaItems {
					return result, false
				}
				result = append(result, overlap{TaskID: left.ID, OtherTaskID: right.ID})
			}
		}
	}
	return result, sessions.Complete && !sessions.HasMore
}
