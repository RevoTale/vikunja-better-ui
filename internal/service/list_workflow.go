package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	"golang.org/x/sync/errgroup"
)

const (
	maxActiveCandidateTasks int64 = 10000
	maxPageConcurrency      int   = 4
)

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
	Scope          TaskScope
	ProjectID      *int64
	Page           int
	PageSize       int
	Now            time.Time
	Location       *time.Location
	Timezone       string
	WeekStart      time.Weekday
	ProjectTitles  map[int64]string
	JobLabelIDs    []int64
	FilterLabelIDs []int64
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
		return completeCandidateList(request, nil), nil
	}
	query := activeTaskQuery(request)
	firstPage, err := client.TasksPage(ctx, query)
	if err != nil {
		return incompleteList(request, ListIssueUpstreamPartial, err), nil
	}
	if firstPage.Total > maxActiveCandidateTasks {
		return incompleteList(request, ListIssueTooLarge, nil), nil
	}

	candidates := make([]taskListCandidate, 0, int(firstPage.Total))
	candidates = appendTaskListCandidates(
		candidates, firstPage.Items, request.ProjectTitles, request.Scope, request.Now, request.Location, request.WeekStart,
	)
	pages, err := loadRemainingTaskPages(ctx, client, query, firstPage.TotalPages)
	if err != nil {
		return incompleteList(request, ListIssueUpstreamPartial, err), nil
	}
	loadedTasks := int64(len(firstPage.Items))
	for _, page := range pages {
		if page.Total != firstPage.Total || page.TotalPages != firstPage.TotalPages {
			return incompleteList(request, ListIssueUpstreamPartial, vikunja.ErrRejectedResponse), nil
		}
		loadedTasks += int64(len(page.Items))
		candidates = appendTaskListCandidates(
			candidates, page.Items, request.ProjectTitles, request.Scope, request.Now, request.Location, request.WeekStart,
		)
	}
	if loadedTasks != firstPage.Total {
		return incompleteList(request, ListIssueUpstreamPartial, vikunja.ErrRejectedResponse), nil
	}

	candidates = filterCandidatesByAnyLabelID(candidates, request.FilterLabelIDs)
	sortTaskList(candidates, request.Scope, request.Now)
	return completeCandidateList(request, candidates), nil
}

func loadRemainingTaskPages(
	ctx context.Context,
	client taskListClient,
	query vikunja.TaskQuery,
	totalPages int64,
) ([]vikunja.TaskPage, error) {
	if totalPages <= 1 {
		return nil, nil
	}

	pages := make([]vikunja.TaskPage, totalPages-1)
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(maxPageConcurrency)
	for pageNumber := int64(2); pageNumber <= totalPages; pageNumber++ {
		index := pageNumber - 2
		group.Go(func() error {
			pageQuery := query
			pageQuery.Page = pageNumber
			page, err := client.TasksPage(groupCtx, pageQuery)
			if err == nil {
				pages[index] = page
			}
			return err
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}
	return pages, nil
}

func filterCandidatesByAnyLabelID(candidates []taskListCandidate, labelIDs []int64) []taskListCandidate {
	if len(labelIDs) == 0 {
		return candidates
	}
	allowed := make(map[int64]struct{}, len(labelIDs))
	for _, labelID := range labelIDs {
		allowed[labelID] = struct{}{}
	}
	filtered := candidates[:0]
	for _, candidate := range candidates {
		for _, label := range candidate.Task.Labels {
			if _, ok := allowed[label.ID]; ok {
				filtered = append(filtered, candidate)
				break
			}
		}
	}
	return filtered
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

func completeCandidateList(request ListRequest, candidates []taskListCandidate) ListResult {
	total := int64(len(candidates))
	start, end, totalPages := listPageBounds(request, total)
	return ListResult{
		Items: materializeTaskList(candidates[start:end]), Page: request.Page, PageSize: request.PageSize,
		TotalItems: total, TotalPages: totalPages, HasMore: int64(request.Page) < totalPages, IsComplete: true,
	}
}

func listPageBounds(request ListRequest, total int64) (int64, int64, int64) {
	start := min(int64((request.Page-1)*request.PageSize), total)
	end := min(start+int64(request.PageSize), total)
	totalPages := (total + int64(request.PageSize) - 1) / int64(request.PageSize)
	return start, end, totalPages
}

func incompleteList(request ListRequest, code ListIssueCode, cause error) ListResult {
	return ListResult{
		Items: []TaskListItem{}, Page: request.Page, PageSize: request.PageSize,
		IsComplete: false, Issue: &ListIssue{Code: code, ProjectID: request.ProjectID, Cause: cause},
	}
}

func validateListRequest(request ListRequest) error {
	if request.Page < 1 || request.PageSize < 1 || request.PageSize > 100 {
		return errors.New("page and page size are invalid")
	}
	if request.Location == nil || request.Timezone == "" {
		return errors.New("timezone is required")
	}
	if request.ProjectID != nil && *request.ProjectID <= 0 {
		return errors.New("project ID must be positive")
	}
	for _, labelID := range request.JobLabelIDs {
		if labelID <= 0 {
			return errors.New("job label ID must be positive")
		}
	}
	for _, labelID := range request.FilterLabelIDs {
		if labelID <= 0 {
			return errors.New("filter label ID must be positive")
		}
	}
	switch request.Scope {
	case TaskScopeToday, TaskScopeWeek, TaskScopeMonth, TaskScopeJobs, TaskScopeUnscheduled, TaskScopeHistory:
		return nil
	default:
		return errors.New("task scope is invalid")
	}
}
