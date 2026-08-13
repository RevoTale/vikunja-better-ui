package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const maxActiveCandidateTasks int64 = 10000

type ListIssueCode string

const (
	ListIssueTooLarge        ListIssueCode = "RESULT_SET_TOO_LARGE"
	ListIssueUpstreamPartial ListIssueCode = "UPSTREAM_PARTIAL"
)

type ListIssue struct {
	Code      ListIssueCode
	ProjectID *int64
	Cause     error
}

type ListRequest struct {
	Scope         TaskScope
	ProjectID     *int64
	Page          int
	PageSize      int
	Now           time.Time
	Location      *time.Location
	Timezone      string
	WeekStart     time.Weekday
	ProjectTitles map[int64]string
	JobLabelIDs   []int64
}

type ListResult struct {
	Items      []TaskListItem
	Page       int
	PageSize   int
	TotalItems int64
	TotalPages int64
	HasMore    bool
	IsComplete bool
	Issue      *ListIssue
}

type taskListClient interface {
	TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error)
}

func ListTasks(ctx context.Context, client taskListClient, request ListRequest) (ListResult, error) {
	if err := validateListRequest(request); err != nil {
		return ListResult{}, err
	}
	if request.Scope == TaskScopeHistory {
		return listHistory(ctx, client, request)
	}
	return listActive(ctx, client, request)
}

func listActive(ctx context.Context, client taskListClient, request ListRequest) (ListResult, error) {
	if request.Scope == TaskScopeJobs && len(request.JobLabelIDs) == 0 {
		return completeList(request, []TaskListItem{}, 0), nil
	}
	query := activeTaskQuery(request)
	firstPage, err := client.TasksPage(ctx, query)
	if err != nil {
		return incompleteList(request, ListIssueUpstreamPartial, err), nil
	}
	if firstPage.Total > maxActiveCandidateTasks {
		return incompleteList(request, ListIssueTooLarge, nil), nil
	}

	tasks := append([]vikunja.Task(nil), firstPage.Items...)
	for pageNumber := int64(2); pageNumber <= firstPage.TotalPages; pageNumber++ {
		query.Page = pageNumber
		page, pageErr := client.TasksPage(ctx, query)
		if pageErr != nil {
			return incompleteList(request, ListIssueUpstreamPartial, pageErr), nil
		}
		if page.Total != firstPage.Total || page.TotalPages != firstPage.TotalPages {
			return incompleteList(request, ListIssueUpstreamPartial, vikunja.ErrRejectedResponse), nil
		}
		tasks = append(tasks, page.Items...)
	}
	if int64(len(tasks)) != firstPage.Total {
		return incompleteList(request, ListIssueUpstreamPartial, vikunja.ErrRejectedResponse), nil
	}

	items := BuildTaskList(
		tasks, request.ProjectTitles, request.Scope, request.Now, request.Location, request.WeekStart,
	)
	return completeList(request, items, int64(len(items))), nil
}

func listHistory(ctx context.Context, client taskListClient, request ListRequest) (ListResult, error) {
	query := historyTaskQuery(request)
	query.Page = int64(request.Page)
	page, err := client.TasksPage(ctx, query)
	if err != nil {
		return ListResult{}, err
	}
	items := BuildTaskList(
		page.Items, request.ProjectTitles, TaskScopeHistory, request.Now, request.Location, request.WeekStart,
	)
	return ListResult{
		Items: items, Page: request.Page, PageSize: request.PageSize,
		TotalItems: page.Total, TotalPages: page.TotalPages, HasMore: int64(request.Page) < page.TotalPages,
		IsComplete: true,
	}, nil
}

func activeTaskQuery(request ListRequest) vikunja.TaskQuery {
	filterParts := []string{"done = false"}
	includeNulls := false
	switch request.Scope {
	case TaskScopeToday:
		filterParts = appendDueBoundary(filterParts, nextLocalDay(request.Now, request.Location))
	case TaskScopeWeek:
		filterParts = appendDueBoundary(filterParts, nextWeekBoundary(request.Now, request.Location, request.WeekStart))
	case TaskScopeMonth:
		filterParts = appendDueBoundary(filterParts, nextMonthBoundary(request.Now, request.Location))
	case TaskScopeUnscheduled:
		filterParts = append(filterParts, "due_date < 0001-01-01")
		includeNulls = true
	case TaskScopeJobs:
		filterParts = append(filterParts, "labels in "+joinIDs(request.JobLabelIDs))
		filterParts = append(filterParts, "repeat_after = 0")
	case TaskScopeHistory:
	}
	filterParts = appendProjectFilter(filterParts, request.ProjectID)
	return vikunja.TaskQuery{
		Page: 1, PerPage: 1000, Filter: strings.Join(filterParts, " && "),
		FilterTimezone: request.Timezone, FilterIncludeNulls: &includeNulls,
	}
}

func joinIDs(values []int64) string {
	parts := make([]string, 0, len(values))
	for _, value := range values {
		parts = append(parts, strconv.FormatInt(value, 10))
	}
	return strings.Join(parts, ", ")
}

func historyTaskQuery(request ListRequest) vikunja.TaskQuery {
	filterParts := appendProjectFilter([]string{"done = true"}, request.ProjectID)
	return vikunja.TaskQuery{
		Page: 1, PerPage: int64(request.PageSize), Filter: strings.Join(filterParts, " && "),
		FilterTimezone: request.Timezone, SortBy: []string{"done_at", "id"}, OrderBy: []string{"desc", "desc"},
	}
}

func appendDueBoundary(parts []string, boundary time.Time) []string {
	return append(parts, "due_date < '"+boundary.Format(time.RFC3339)+"'")
}

func appendProjectFilter(parts []string, projectID *int64) []string {
	if projectID != nil {
		parts = append(parts, fmt.Sprintf("project = %d", *projectID))
	}
	return parts
}

func completeList(request ListRequest, items []TaskListItem, total int64) ListResult {
	start := int64((request.Page - 1) * request.PageSize)
	if start > total {
		start = total
	}
	end := start + int64(request.PageSize)
	if end > total {
		end = total
	}
	totalPages := (total + int64(request.PageSize) - 1) / int64(request.PageSize)
	return ListResult{
		Items: items[start:end], Page: request.Page, PageSize: request.PageSize,
		TotalItems: total, TotalPages: totalPages, HasMore: int64(request.Page) < totalPages, IsComplete: true,
	}
}

func incompleteList(request ListRequest, code ListIssueCode, cause error) ListResult {
	return ListResult{
		Items: []TaskListItem{}, Page: request.Page, PageSize: request.PageSize,
		IsComplete: false, Issue: &ListIssue{Code: code, ProjectID: request.ProjectID, Cause: cause},
	}
}

func validateListRequest(request ListRequest) error {
	if request.Page < 1 || request.PageSize < 1 || request.PageSize > 100 {
		return fmt.Errorf("page and page size are invalid")
	}
	if request.Location == nil || request.Timezone == "" {
		return fmt.Errorf("timezone is required")
	}
	if request.ProjectID != nil && *request.ProjectID <= 0 {
		return fmt.Errorf("project ID must be positive")
	}
	for _, labelID := range request.JobLabelIDs {
		if labelID <= 0 {
			return fmt.Errorf("job label ID must be positive")
		}
	}
	switch request.Scope {
	case TaskScopeToday, TaskScopeWeek, TaskScopeMonth, TaskScopeJobs, TaskScopeUnscheduled, TaskScopeHistory:
		return nil
	default:
		return fmt.Errorf("task scope is invalid")
	}
}
