package integration

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

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

type errorResponse struct {
	Error apiError `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type jobsResponse struct {
	Items      []jobResponse `json:"items"`
	Page       int           `json:"page"`
	PageSize   int           `json:"pageSize"`
	TotalItems int64         `json:"totalItems"`
	TotalPages int64         `json:"totalPages"`
	HasMore    bool          `json:"hasMore"`
	IsComplete bool          `json:"isComplete"`
	Issues     []apiError    `json:"issues"`
}

type jobResponse struct {
	ID          string          `json:"id"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Project     projectResponse `json:"project"`
	Priority    string          `json:"priority"`
	DueAt       *time.Time      `json:"dueAt"`
	HasDueTime  bool            `json:"hasDueTime"`
	StartAt     *time.Time      `json:"startAt"`
	EndAt       *time.Time      `json:"endAt"`
	Labels      []labelResponse `json:"labels"`
	DoneAt      *time.Time      `json:"doneAt"`
	FinishAt    *time.Time      `json:"finishAt"`
	IsOverdue   bool            `json:"isOverdue"`
	Timezone    string          `json:"timezone"`
	URL         string          `json:"url"`
}

type projectResponse struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	IsDefault bool   `json:"isDefault"`
}

type labelResponse struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

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
	jobLabelIDs := service.ExactLabelIDs(labels, "job")
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
	copy := value
	return &copy
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

var (
	errInvalidAuthorization = errors.New("invalid authorization")
	errInvalidRequest       = errors.New("invalid request")
	errResultSetTooLarge    = errors.New("result set too large")
)

func parseJobsRequest(request *http.Request) (jobsRequest, error) {
	token, err := bearerToken(request.Header.Values("Authorization"))
	if err != nil {
		return jobsRequest{}, err
	}
	query, err := url.ParseQuery(request.URL.RawQuery)
	if err != nil {
		return jobsRequest{}, errInvalidRequest
	}
	for key := range query {
		if key != "label" && key != "status" && key != "completedFrom" && key != "completedBefore" &&
			key != "sortBy" && key != "sortOrder" &&
			key != "page" && key != "pageSize" {
			return jobsRequest{}, errInvalidRequest
		}
	}
	status, completedFrom, completedBefore, err := parseJobsStatus(query)
	if err != nil {
		return jobsRequest{}, err
	}
	sortBy, sortOrder, err := parseJobsSort(query, status)
	if err != nil {
		return jobsRequest{}, err
	}
	page, err := positiveQueryInt(query, "page", 1, 1<<31-1)
	if err != nil {
		return jobsRequest{}, err
	}
	pageSize, err := positiveQueryInt(query, "pageSize", defaultPageSize, maxPageSize)
	if err != nil {
		return jobsRequest{}, err
	}
	label := ""
	if values, present := query["label"]; present {
		if len(values) != 1 || values[0] == "" || len(values[0]) > maxLabelBytes || !utf8.ValidString(values[0]) {
			return jobsRequest{}, errInvalidRequest
		}
		label = values[0]
	}
	return jobsRequest{
		token: token, label: label, status: status, completedFrom: completedFrom,
		completedBefore: completedBefore, page: page, pageSize: pageSize,
		sortBy: sortBy, sortOrder: sortOrder,
	}, nil
}

func parseJobsStatus(query url.Values) (jobsStatus, time.Time, time.Time, error) {
	status := jobsStatusActive
	if values, present := query["status"]; present {
		if len(values) != 1 {
			return "", time.Time{}, time.Time{}, errInvalidRequest
		}
		status = jobsStatus(values[0])
	}
	if status != jobsStatusActive && status != jobsStatusCompleted && status != jobsStatusAll {
		return "", time.Time{}, time.Time{}, errInvalidRequest
	}
	fromValues, hasFrom := query["completedFrom"]
	beforeValues, hasBefore := query["completedBefore"]
	if status == jobsStatusActive {
		if hasFrom || hasBefore {
			return "", time.Time{}, time.Time{}, errInvalidRequest
		}
		return status, time.Time{}, time.Time{}, nil
	}
	if !hasFrom || len(fromValues) != 1 || !hasBefore || len(beforeValues) != 1 {
		return "", time.Time{}, time.Time{}, errInvalidRequest
	}
	completedFrom, fromErr := time.Parse(time.RFC3339, fromValues[0])
	completedBefore, beforeErr := time.Parse(time.RFC3339, beforeValues[0])
	if fromErr != nil || beforeErr != nil || !completedFrom.Before(completedBefore) {
		return "", time.Time{}, time.Time{}, errInvalidRequest
	}
	return status, completedFrom, completedBefore, nil
}

func parseJobsSort(query url.Values, status jobsStatus) (service.JobSort, service.SortOrder, error) {
	sortValues, hasSort := query["sortBy"]
	orderValues, hasOrder := query["sortOrder"]
	if status != jobsStatusAll {
		if hasSort || hasOrder {
			return "", "", errInvalidRequest
		}
		return "", "", nil
	}

	sortBy := jobsSortStartAt
	if hasSort {
		if len(sortValues) != 1 {
			return "", "", errInvalidRequest
		}
		sortBy = service.JobSort(sortValues[0])
	}
	if sortBy != jobsSortStartAt && sortBy != jobsSortFinishAt {
		return "", "", errInvalidRequest
	}

	sortOrder := jobsSortAscending
	if hasOrder {
		if len(orderValues) != 1 {
			return "", "", errInvalidRequest
		}
		sortOrder = service.SortOrder(orderValues[0])
	}
	if sortOrder != jobsSortAscending && sortOrder != jobsSortDescending {
		return "", "", errInvalidRequest
	}
	return sortBy, sortOrder, nil
}

func bearerToken(values []string) (string, error) {
	if len(values) != 1 {
		return "", errInvalidAuthorization
	}
	scheme, token, ok := strings.Cut(values[0], " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") || !validToken(token) {
		return "", errInvalidAuthorization
	}
	return token, nil
}

func validToken(token string) bool {
	if token == "" || len(token) > maxTokenBytes {
		return false
	}
	for index := range len(token) {
		if token[index] < 0x21 || token[index] > 0x7e {
			return false
		}
	}
	return true
}

func positiveQueryInt(query url.Values, key string, fallback int, maximum int) (int, error) {
	values, present := query[key]
	if !present {
		return fallback, nil
	}
	if len(values) != 1 {
		return 0, errInvalidRequest
	}
	value, err := strconv.Atoi(values[0])
	if err != nil || value < 1 || value > maximum {
		return 0, errInvalidRequest
	}
	return value, nil
}

func writeError(writer http.ResponseWriter, status int, code string, message string) {
	writeJSON(writer, status, errorResponse{Error: apiError{Code: code, Message: message}})
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}
