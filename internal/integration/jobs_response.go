package integration

import (
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func (handler *jobsHandler) mapJobsResponse(
	result service.ListResult,
	projects []vikunja.Project,
	user vikunja.User,
	now time.Time,
) (jobsResponse, error) {
	projectByID := make(map[int64]vikunja.Project, len(projects))
	for _, project := range projects {
		projectByID[project.ID] = project
	}
	items := make([]jobResponse, 0, len(result.Items))
	for _, item := range result.Items {
		mapped, mapErr := handler.mapJob(item, projectByID, user, now)
		if mapErr != nil {
			return jobsResponse{}, mapErr
		}
		items = append(items, mapped)
	}
	return jobsResponse{
		Items: items, Page: result.Page, PageSize: result.PageSize,
		TotalItems: result.TotalItems, TotalPages: result.TotalPages,
		HasMore: result.HasMore, IsComplete: true, Issues: []apiError{},
	}, nil
}

func (handler *jobsHandler) mapJob(
	item service.TaskListItem,
	projects map[int64]vikunja.Project,
	user vikunja.User,
	now time.Time,
) (jobResponse, error) {
	project, ok := projects[item.Task.ProjectID]
	if !ok {
		return jobResponse{}, vikunja.ErrRejectedResponse
	}
	priority, err := priorityName(item.Task.Priority)
	if err != nil {
		return jobResponse{}, err
	}
	taskURL, err := url.JoinPath(handler.appURL.String(), "tasks", strconv.FormatInt(item.Task.ID, 10))
	if err != nil {
		return jobResponse{}, err
	}
	labels := make([]labelResponse, 0, len(item.Task.Labels))
	for _, label := range item.Task.Labels {
		labels = append(labels, labelResponse{ID: strconv.FormatInt(label.ID, 10), Title: label.Title})
	}
	var doneAt *time.Time
	if item.Task.Done {
		doneAt = optionalTime(item.Task.DoneAt)
	}
	finishAt := optionalTime(service.JobFinishAt(item.Task))
	return jobResponse{
		ID: strconv.FormatInt(item.Task.ID, 10), Title: item.Task.Title, Description: item.Task.Description,
		Project: projectResponse{
			ID: strconv.FormatInt(project.ID, 10), Title: project.Title,
			IsDefault: project.ID == user.Settings.DefaultProjectID,
		},
		Priority: priority, DueAt: optionalTime(item.Task.DueDate),
		HasDueTime: !item.Task.DueDate.IsZero() && !item.Classification.DateOnly,
		StartAt:    optionalTime(item.Task.StartDate), EndAt: optionalTime(item.Task.EndDate), Labels: labels,
		DoneAt: doneAt, FinishAt: finishAt,
		IsOverdue: !item.Task.Done && !item.Task.DueDate.IsZero() && item.Task.DueDate.Before(now),
		Timezone:  user.Settings.Timezone,
		URL:       taskURL,
	}, nil
}

func emptyJobsResponse(input jobsRequest) jobsResponse {
	return jobsResponse{
		Items: []jobResponse{}, Page: input.page, PageSize: input.pageSize,
		IsComplete: true, Issues: []apiError{},
	}
}

func priorityName(priority int64) (string, error) {
	priorities := [...]string{"UNSET", "LOW", "MEDIUM", "HIGH", "URGENT", "DO_NOW"}
	if priority < 0 || priority >= int64(len(priorities)) {
		return "", vikunja.ErrRejectedResponse
	}
	return priorities[priority], nil
}

func optionalTime(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	return new(value)
}

func (handler *jobsHandler) writeIntegrationError(writer http.ResponseWriter, err error) {
	if errors.Is(err, errResultSetTooLarge) {
		writeError(
			writer,
			http.StatusUnprocessableEntity,
			string(service.ListIssueTooLarge),
			"The matching task set is too large.",
		)
		return
	}
	if upstream, ok := errors.AsType[*vikunja.Error](err); ok {
		switch upstream.Status {
		case http.StatusUnauthorized:
			writer.Header().Set("WWW-Authenticate", "Bearer")
			writeError(writer, http.StatusUnauthorized, "UNAUTHENTICATED", "The Vikunja API token was rejected.")
			return
		case http.StatusForbidden:
			writeError(writer, http.StatusForbidden, "FORBIDDEN", "The Vikunja API token lacks a required permission.")
			return
		}
	}
	if handler.logger != nil {
		handler.logger.Error("jobs integration failed", "cause", err)
	}
	writeError(writer, http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "Vikunja could not provide the requested jobs.")
}
