// Package integration exposes caller-token-authenticated, read-only dashboard endpoints.
package integration

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/concurrent"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const (
	defaultPageSize    = 30
	maxPageSize        = 100
	maxLabelBytes      = 250
	maxTokenBytes      = 4096
	integrationTimeout = 30 * time.Second
)

type jobsHandler struct {
	vikunjaURL *url.URL
	appURL     *url.URL
	logger     *slog.Logger
	now        func() time.Time
}

type jobsRequest struct {
	token           string
	label           string
	status          jobsStatus
	completedFrom   time.Time
	completedBefore time.Time
	page            int
	pageSize        int
	sortBy          service.JobSort
	sortOrder       service.SortOrder
}

type jobsStatus string

const (
	jobsStatusActive    jobsStatus = "active"
	jobsStatusCompleted jobsStatus = "completed"
	jobsStatusAll       jobsStatus = "all"

	jobsSortStartAt    = service.JobSortStartAt
	jobsSortFinishAt   = service.JobSortFinishAt
	jobsSortAscending  = service.SortAscending
	jobsSortDescending = service.SortDescending
)

// NewJobsHandler returns the read-only, caller-authenticated jobs integration endpoint.
func NewJobsHandler(vikunjaURL *url.URL, appURL *url.URL, logger *slog.Logger, now func() time.Time) http.Handler {
	return &jobsHandler{vikunjaURL: vikunjaURL, appURL: appURL, logger: logger, now: now}
}

func (handler *jobsHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "private, no-store")
	writer.Header().Set("Vary", "Authorization")
	if request.Method != http.MethodGet {
		writer.Header().Set("Allow", http.MethodGet)
		writeError(writer, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Only GET requests are supported.")
		return
	}
	input, err := parseJobsRequest(request)
	if err != nil {
		status := http.StatusBadRequest
		code := "INVALID_REQUEST"
		message := "The request parameters are invalid."
		if errors.Is(err, errInvalidAuthorization) {
			status = http.StatusUnauthorized
			code = "UNAUTHENTICATED"
			message = "A valid Vikunja API token is required."
			writer.Header().Set("WWW-Authenticate", "Bearer")
		}
		writeError(writer, status, code, message)
		return
	}
	ctx, cancel := context.WithTimeout(request.Context(), integrationTimeout)
	defer cancel()
	client := vikunja.NewClient(handler.vikunjaURL, input.token, vikunja.WithLogger(handler.logger))
	defer client.CloseIdleConnections()
	response, err := handler.jobs(ctx, client, input)
	if err != nil {
		handler.writeIntegrationError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, response)
}

func (handler *jobsHandler) jobs(
	ctx context.Context,
	client *vikunja.Client,
	input jobsRequest,
) (jobsResponse, error) {
	userRead := concurrent.Start(func() (vikunja.User, error) { return client.CurrentUser(ctx) })
	projectsRead := concurrent.Start(func() ([]vikunja.Project, error) { return client.Projects(ctx) })
	labelsRead := concurrent.Start(func() ([]vikunja.Label, error) { return client.Labels(ctx) })

	user, err := userRead.Wait()
	if err != nil {
		return jobsResponse{}, err
	}
	location, err := time.LoadLocation(user.Settings.Timezone)
	if err != nil || user.Settings.Timezone == "" {
		return jobsResponse{}, vikunja.ErrRejectedResponse
	}
	labels, labelsErr := labelsRead.Wait()
	if labelsErr != nil {
		return jobsResponse{}, labelsErr
	}
	jobLabelIDs := service.ExactLabelIDs(labels, "vbu:job")
	var filterLabelIDs []int64
	if input.label != "" {
		filterLabelIDs = service.ExactLabelIDs(labels, input.label)
		if len(filterLabelIDs) == 0 {
			if _, projectsErr := projectsRead.Wait(); projectsErr != nil {
				return jobsResponse{}, projectsErr
			}
			return emptyJobsResponse(input), nil
		}
	}
	now := handler.now()
	result, err := service.ListTasks(ctx, client, service.ListRequest{
		Scope: jobsTaskScope(input.status), Page: input.page, PageSize: input.pageSize,
		Now: now, Location: location, Timezone: user.Settings.Timezone,
		WeekStart:   time.Weekday(user.Settings.WeekStart),
		JobLabelIDs: jobLabelIDs, FilterLabelIDs: filterLabelIDs,
		CompletedFrom: input.completedFrom, CompletedBefore: input.completedBefore,
		JobSort: input.sortBy, SortOrder: input.sortOrder,
	})
	if err != nil {
		return jobsResponse{}, err
	}
	if result.Issue != nil {
		if result.Issue.Cause != nil {
			return jobsResponse{}, result.Issue.Cause
		}
		return jobsResponse{}, errResultSetTooLarge
	}
	projects, projectsErr := projectsRead.Wait()
	if projectsErr != nil {
		return jobsResponse{}, projectsErr
	}
	return handler.mapJobsResponse(result, projects, user, now)
}

func jobsTaskScope(status jobsStatus) service.TaskScope {
	switch status {
	case jobsStatusActive:
		return service.TaskScopeJobs
	case jobsStatusCompleted:
		return service.TaskScopeCompletedJobs
	case jobsStatusAll:
		return service.TaskScopeAllJobs
	}
	return ""
}

var (
	errInvalidAuthorization = errors.New("invalid authorization")
	errInvalidRequest       = errors.New("invalid request")
	errResultSetTooLarge    = errors.New("result set too large")
)
