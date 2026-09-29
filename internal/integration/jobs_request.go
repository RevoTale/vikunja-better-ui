package integration

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

func parseJobsRequest(request *http.Request) (jobsRequest, error) {
	token, err := bearerToken(request.Header.Values("Authorization"))
	if err != nil {
		return jobsRequest{}, err
	}
	query, err := jobsQuery(request.URL.RawQuery)
	if err != nil {
		return jobsRequest{}, errInvalidRequest
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
	label, err := jobsLabel(query)
	if err != nil {
		return jobsRequest{}, err
	}
	return jobsRequest{
		token: token, label: label, status: status, completedFrom: completedFrom,
		completedBefore: completedBefore, page: page, pageSize: pageSize,
		sortBy: sortBy, sortOrder: sortOrder,
	}, nil
}

func jobsQuery(raw string) (url.Values, error) {
	query, err := url.ParseQuery(raw)
	if err != nil {
		return nil, errInvalidRequest
	}
	for key := range query {
		switch key {
		case "label", "status", "completedFrom", "completedBefore", "sortBy", "sortOrder", "page", "pageSize":
		default:
			return nil, errInvalidRequest
		}
	}
	return query, nil
}

func jobsLabel(query url.Values) (string, error) {
	values, present := query["label"]
	if !present {
		return "", nil
	}
	if len(values) != 1 || values[0] == "" || len(values[0]) > maxLabelBytes || !utf8.ValidString(values[0]) {
		return "", errInvalidRequest
	}
	return values[0], nil
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
	if status == jobsStatusActive {
		if query.Has("completedFrom") || query.Has("completedBefore") {
			return "", time.Time{}, time.Time{}, errInvalidRequest
		}
		return status, time.Time{}, time.Time{}, nil
	}
	from, before, err := completionRange(query)
	if err != nil {
		return "", time.Time{}, time.Time{}, err
	}
	return status, from, before, nil
}

func completionRange(query url.Values) (time.Time, time.Time, error) {
	fromValues := query["completedFrom"]
	beforeValues := query["completedBefore"]
	if len(fromValues) != 1 || len(beforeValues) != 1 {
		return time.Time{}, time.Time{}, errInvalidRequest
	}
	completedFrom, fromErr := time.Parse(time.RFC3339, fromValues[0])
	completedBefore, beforeErr := time.Parse(time.RFC3339, beforeValues[0])
	if fromErr != nil || beforeErr != nil || !completedFrom.Before(completedBefore) {
		return time.Time{}, time.Time{}, errInvalidRequest
	}
	return completedFrom, completedBefore, nil
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
