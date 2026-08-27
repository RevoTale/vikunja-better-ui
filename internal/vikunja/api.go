package vikunja

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"
)

const (
	maxUpstreamPageSize = 1000
	maxProjectCount     = 10000
	maxLabelCount       = 10000
)

var (
	ErrRejectedResponse = errors.New("vikunja returned an inconsistent response")
	ErrConditionFailed  = errors.New("vikunja task state check failed")
)

func (client *Client) CurrentUser(ctx context.Context) (User, error) {
	return client.currentUserRequests.do(ctx, client.fetchCurrentUser)
}

func (client *Client) fetchCurrentUser(ctx context.Context) (User, error) {
	var user User
	if _, err := client.doJSON(ctx, http.MethodGet, "user", nil, "", &user); err != nil {
		return User{}, err
	}
	if user.ID <= 0 || user.Username == "" {
		return User{}, ErrRejectedResponse
	}
	return user, nil
}

func (client *Client) Projects(ctx context.Context) ([]Project, error) {
	return client.projectRequests.do(ctx, client.fetchProjects)
}

func (client *Client) fetchProjects(ctx context.Context) ([]Project, error) {
	projects := make([]Project, 0)
	for pageNumber := int64(1); ; pageNumber++ {
		query := url.Values{
			"page":     []string{strconv.FormatInt(pageNumber, 10)},
			"per_page": []string{strconv.Itoa(maxUpstreamPageSize)},
		}
		var response page[Project]
		if _, err := client.doJSONWithQuery(ctx, http.MethodGet, "projects", query, nil, "", &response); err != nil {
			return nil, err
		}
		if err := validatePage(response.Page, response.PerPage, response.Total, response.TotalPages, pageNumber, maxUpstreamPageSize); err != nil {
			return nil, err
		}
		if err := validatePageItemCount(len(response.Items), response.Page, response.PerPage, response.Total, response.TotalPages); err != nil {
			return nil, err
		}
		if response.Total > maxProjectCount || int64(len(projects)+len(response.Items)) > response.Total {
			return nil, ErrRejectedResponse
		}
		projects = append(projects, response.Items...)
		if response.Total == 0 {
			break
		}
		if pageNumber == response.TotalPages {
			break
		}
	}
	return projects, nil
}

func (client *Client) TasksPage(ctx context.Context, input TaskQuery) (TaskPage, error) {
	if err := validateTaskQuery(input); err != nil {
		return TaskPage{}, err
	}

	query := url.Values{
		"page":     []string{strconv.FormatInt(input.Page, 10)},
		"per_page": []string{strconv.FormatInt(input.PerPage, 10)},
	}
	setOptionalQuery(query, "q", input.Search)
	setOptionalQuery(query, "filter", input.Filter)
	setOptionalQuery(query, "filter_timezone", input.FilterTimezone)
	if input.FilterIncludeNulls != nil {
		query.Set("filter_include_nulls", strconv.FormatBool(*input.FilterIncludeNulls))
	}
	for _, field := range input.SortBy {
		query.Add("sort_by", field)
	}
	for _, order := range input.OrderBy {
		query.Add("order_by", order)
	}

	var response TaskPage
	if _, err := client.doJSONWithQuery(ctx, http.MethodGet, "tasks", query, nil, "", &response); err != nil {
		return TaskPage{}, err
	}
	if err := validatePage(response.Page, response.PerPage, response.Total, response.TotalPages, input.Page, input.PerPage); err != nil {
		return TaskPage{}, err
	}
	if err := validatePageItemCount(len(response.Items), response.Page, response.PerPage, response.Total, response.TotalPages); err != nil {
		return TaskPage{}, ErrRejectedResponse
	}
	return response, nil
}

func validateTaskQuery(input TaskQuery) error {
	if input.Page < 1 || input.PerPage < 1 || input.PerPage > maxUpstreamPageSize {
		return errors.New("page and per-page values are invalid")
	}
	if len(input.SortBy) != len(input.OrderBy) {
		return errors.New("sort fields and orders must match")
	}
	if input.Search != "" && input.Filter != "" {
		return errors.New("search and filter cannot be combined")
	}
	for index, field := range input.SortBy {
		if field == "" || (input.OrderBy[index] != "asc" && input.OrderBy[index] != "desc") {
			return errors.New("sort field or order is invalid")
		}
	}
	return nil
}

func setOptionalQuery(query url.Values, key string, value string) {
	if value != "" {
		query.Set(key, value)
	}
}

func (client *Client) Labels(ctx context.Context) ([]Label, error) {
	return client.labelRequests.do(ctx, client.fetchLabels)
}

func (client *Client) fetchLabels(ctx context.Context) ([]Label, error) {
	labels := make([]Label, 0)
	for pageNumber := int64(1); ; pageNumber++ {
		query := url.Values{
			"page":     []string{strconv.FormatInt(pageNumber, 10)},
			"per_page": []string{strconv.Itoa(maxUpstreamPageSize)},
		}
		var response page[Label]
		if _, err := client.doJSONWithQuery(ctx, http.MethodGet, "labels", query, nil, "", &response); err != nil {
			return nil, err
		}
		if err := validatePage(response.Page, response.PerPage, response.Total, response.TotalPages, pageNumber, maxUpstreamPageSize); err != nil {
			return nil, err
		}
		if err := validatePageItemCount(len(response.Items), response.Page, response.PerPage, response.Total, response.TotalPages); err != nil {
			return nil, err
		}
		if response.Total > maxLabelCount || int64(len(labels)+len(response.Items)) > response.Total {
			return nil, ErrRejectedResponse
		}
		labels = append(labels, response.Items...)
		if response.Total == 0 || pageNumber == response.TotalPages {
			break
		}
	}
	return labels, nil
}

func (client *Client) CreateLabel(ctx context.Context, input LabelWrite) (Label, error) {
	if input.Title == "" {
		return Label{}, errors.New("label title is required")
	}
	var label Label
	if _, err := client.doJSON(ctx, http.MethodPost, "labels", input, "", &label); err != nil {
		return Label{}, err
	}
	if label.ID <= 0 || label.Title == "" {
		return Label{}, ErrRejectedResponse
	}
	return label, nil
}

func (client *Client) AttachLabel(ctx context.Context, taskID int64, labelID int64) error {
	if taskID <= 0 || labelID <= 0 {
		return errors.New("task ID and label ID must be positive")
	}
	input := labelTask{LabelID: labelID}
	var response labelTask
	path := "tasks/" + strconv.FormatInt(taskID, 10) + "/labels"
	if _, err := client.doJSON(ctx, http.MethodPost, path, input, "", &response); err != nil {
		return err
	}
	if response.LabelID != labelID {
		return ErrRejectedResponse
	}
	return nil
}

func (client *Client) DetachLabel(ctx context.Context, taskID int64, labelID int64) error {
	if taskID <= 0 || labelID <= 0 {
		return errors.New("task ID and label ID must be positive")
	}
	path := "tasks/" + strconv.FormatInt(taskID, 10) + "/labels/" + strconv.FormatInt(labelID, 10)
	_, err := client.doJSON(ctx, http.MethodDelete, path, nil, "", nil)
	return err
}

func (client *Client) Task(ctx context.Context, taskID int64) (Task, ResponseMetadata, error) {
	if taskID <= 0 {
		return Task{}, ResponseMetadata{}, errors.New("task ID must be positive")
	}

	var task Task
	metadata, err := client.doJSON(ctx, http.MethodGet, "tasks/"+strconv.FormatInt(taskID, 10), nil, "", &task)
	if err != nil {
		return Task{}, ResponseMetadata{}, err
	}
	if task.ID != taskID {
		return Task{}, ResponseMetadata{}, ErrRejectedResponse
	}
	return task, metadata, nil
}

func (client *Client) DeleteTask(ctx context.Context, taskID int64) error {
	if taskID <= 0 {
		return errors.New("task ID must be positive")
	}

	path := "tasks/" + strconv.FormatInt(taskID, 10)
	_, err := client.doJSON(ctx, http.MethodDelete, path, nil, "", nil)
	return err
}

func (client *Client) CreateTask(ctx context.Context, projectID int64, input TaskWrite) (Task, error) {
	return client.createTask(ctx, projectID, input, markdownQuery())
}

// CreateTaskHTML preserves Vikunja's stored HTML representation. It is used
// for internal snapshots whose hidden reconciliation marker must not be lost
// during Markdown conversion.
func (client *Client) CreateTaskHTML(ctx context.Context, projectID int64, input TaskWrite) (Task, error) {
	return client.createTask(ctx, projectID, input, nil)
}

func (client *Client) createTask(ctx context.Context, projectID int64, input TaskWrite, query url.Values) (Task, error) {
	if projectID <= 0 {
		return Task{}, errors.New("project ID must be positive")
	}

	var task Task
	path := "projects/" + strconv.FormatInt(projectID, 10) + "/tasks"
	if _, err := client.doJSONWithQuery(ctx, http.MethodPost, path, query, input, "", &task); err != nil {
		return Task{}, err
	}
	if task.ID <= 0 {
		return Task{}, ErrRejectedResponse
	}
	return task, nil
}

func (client *Client) PatchTask(ctx context.Context, taskID int64, patch TaskPatch, etag string) (Task, error) {
	if taskID <= 0 || etag == "" {
		return Task{}, errors.New("task ID and ETag are required")
	}

	var task Task
	path := "tasks/" + strconv.FormatInt(taskID, 10)
	if _, err := client.doJSON(ctx, http.MethodPatch, path, patch, etag, &task); err != nil {
		return Task{}, err
	}
	if task.ID != taskID {
		return Task{}, ErrRejectedResponse
	}
	return task, nil
}

type jsonPatchOperation struct {
	Operation string `json:"op"`
	Path      string `json:"path"`
	Value     any    `json:"value"`
}

func (client *Client) PatchTaskChecked(ctx context.Context, taskID int64, patch TaskPatch, check TaskCheck) (Task, error) {
	if taskID <= 0 {
		return Task{}, errors.New("task ID must be positive")
	}
	operations := taskCheckOperations(check)
	if len(operations) == 0 {
		return Task{}, errors.New("at least one task state check is required")
	}
	patchOperations := taskPatchOperations(patch)
	if len(patchOperations) == 0 {
		return Task{}, errors.New("task patch is empty")
	}
	operations = append(operations, patchOperations...)
	var task Task
	path := "tasks/" + strconv.FormatInt(taskID, 10)
	if _, err := client.doJSONWithQueryAndContentType(
		ctx, http.MethodPatch, path, nil, operations, "", "application/json-patch+json", &task,
	); err != nil {
		var upstreamError *Error
		if errors.As(err, &upstreamError) && upstreamError.Status == http.StatusUnprocessableEntity {
			return Task{}, ErrConditionFailed
		}
		return Task{}, err
	}
	if task.ID != taskID {
		return Task{}, ErrRejectedResponse
	}
	return task, nil
}

func taskCheckOperations(check TaskCheck) []jsonPatchOperation {
	operations := make([]jsonPatchOperation, 0, 7)
	operations = appendJSONPatchValue(operations, "test", "/done", check.Done)
	operations = appendJSONPatchValue(operations, "test", "/done_at", check.DoneAt)
	operations = appendJSONPatchValue(operations, "test", "/due_date", check.DueDate)
	operations = appendJSONPatchValue(operations, "test", "/start_date", check.StartDate)
	operations = appendJSONPatchValue(operations, "test", "/end_date", check.EndDate)
	operations = appendJSONPatchValue(operations, "test", "/repeat_after", check.RepeatAfter)
	operations = appendJSONPatchValue(operations, "test", "/repeat_mode", check.RepeatMode)
	return operations
}

func taskPatchOperations(patch TaskPatch) []jsonPatchOperation {
	operations := make([]jsonPatchOperation, 0, 6)
	operations = appendJSONPatchValue(operations, "replace", "/done", patch.Done)
	operations = appendJSONPatchValue(operations, "replace", "/due_date", patch.DueDate)
	operations = appendJSONPatchValue(operations, "replace", "/start_date", patch.StartDate)
	operations = appendJSONPatchValue(operations, "replace", "/end_date", patch.EndDate)
	operations = appendJSONPatchValue(operations, "replace", "/repeat_after", patch.RepeatAfter)
	operations = appendJSONPatchValue(operations, "replace", "/repeat_mode", patch.RepeatMode)
	return operations
}

func appendJSONPatchValue[T any](operations []jsonPatchOperation, operation string, path string, value *T) []jsonPatchOperation {
	if value == nil {
		return operations
	}
	return append(operations, jsonPatchOperation{Operation: operation, Path: path, Value: *value})
}

func validatePage(pageNumber int64, perPage int64, total int64, totalPages int64, expectedPage int64, expectedPerPage int64) error {
	if pageNumber != expectedPage || perPage != expectedPerPage || total < 0 || totalPages < 0 {
		return ErrRejectedResponse
	}
	if total == 0 {
		if pageNumber != 1 || totalPages != 0 {
			return ErrRejectedResponse
		}
		return nil
	}
	if totalPages < 1 || pageNumber > totalPages {
		return ErrRejectedResponse
	}
	expectedPages := (total + perPage - 1) / perPage
	if totalPages != expectedPages {
		return ErrRejectedResponse
	}
	return nil
}

func validatePageItemCount(itemCount int, pageNumber int64, perPage int64, total int64, totalPages int64) error {
	expected := perPage
	if total == 0 {
		expected = 0
	} else if pageNumber == totalPages {
		expected = total - (pageNumber-1)*perPage
	}
	if int64(itemCount) != expected {
		return ErrRejectedResponse
	}
	return nil
}

func markdownQuery() url.Values {
	return url.Values{"format": []string{"markdown"}}
}
