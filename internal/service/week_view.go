package service

import (
	"cmp"
	"context"
	"errors"
	"math"
	"slices"
	"strings"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type WeekRequest struct {
	Containing time.Time
	Now        time.Time
	Location   *time.Location
	Timezone   string
	WeekStart  time.Weekday
	ProjectID  *int64
}

type WeekProjection struct {
	Source     TaskListItem
	DueAt      time.Time
	HasDueTime bool
}

type WeekDay struct {
	Date        time.Time
	Items       []TaskListItem
	Projections []WeekProjection
}

type WeekResult struct {
	Start      time.Time
	End        time.Time
	Days       []WeekDay
	IsComplete bool
	Issue      *ListIssue
}

func ListWeek(ctx context.Context, client taskListClient, request WeekRequest) (WeekResult, error) {
	if request.Location == nil || request.Timezone == "" {
		return WeekResult{}, errors.New("timezone is required")
	}
	start, end := requestedWeekRange(request)
	query := weekTaskQuery(request, start, end)
	firstPage, err := client.TasksPage(ctx, query)
	if err != nil {
		return incompleteWeek(start, end, request.ProjectID, ListIssueUpstreamPartial, err), nil
	}
	if firstPage.Total > maxActiveCandidateTasks {
		return incompleteWeek(start, end, request.ProjectID, ListIssueTooLarge, nil), nil
	}
	pages, err := loadRemainingTaskPages(ctx, client, query, firstPage.TotalPages)
	if err != nil {
		return incompleteWeek(start, end, request.ProjectID, ListIssueUpstreamPartial, err), nil
	}
	taskGroups := make([][]vikunja.Task, 1, len(pages)+1)
	taskGroups[0] = firstPage.Items
	loaded := int64(len(firstPage.Items))
	for _, page := range pages {
		if page.Total != firstPage.Total || page.TotalPages != firstPage.TotalPages {
			return incompleteWeek(start, end, request.ProjectID, ListIssueUpstreamPartial, vikunja.ErrRejectedResponse), nil
		}
		loaded += int64(len(page.Items))
		taskGroups = append(taskGroups, page.Items)
	}
	if loaded != firstPage.Total {
		return incompleteWeek(start, end, request.ProjectID, ListIssueUpstreamPartial, vikunja.ErrRejectedResponse), nil
	}
	return buildWeekView(request, taskGroups...), nil
}

func BuildWeekView(tasks []vikunja.Task, request WeekRequest) WeekResult {
	return buildWeekView(request, tasks)
}

func buildWeekView(request WeekRequest, taskGroups ...[]vikunja.Task) WeekResult {
	location := request.Location
	if location == nil {
		location = time.UTC
	}
	containing := request.Containing
	if containing.IsZero() {
		containing = request.Now
	}
	start, end := weekRange(containing, location, request.WeekStart)
	result := WeekResult{Start: start, End: end, Days: makeWeekDays(start), IsComplete: true}

	for _, tasks := range taskGroups {
		for index := range tasks {
			task := &tasks[index]
			classification := ClassifyTask(*task)
			if task.Done || task.DueDate.IsZero() {
				continue
			}
			candidate := taskListCandidate{Task: task, Classification: classification}
			if !task.DueDate.Before(start) && task.DueDate.Before(end) {
				dayIndex := weekDayIndex(start, task.DueDate, location)
				if dayIndex >= 0 {
					result.Days[dayIndex].Items = append(
						result.Days[dayIndex].Items,
						weekTaskListItem(candidate),
					)
				}
			}
			appendWeekProjections(&result, candidate, request.Now, location)
		}
	}

	compareItems := compareWeekTaskListItem(request.Now)
	for index := range result.Days {
		slices.SortFunc(result.Days[index].Items, compareItems)
		slices.SortFunc(result.Days[index].Projections, compareWeekProjection)
	}
	return result
}

func weekTaskListItem(candidate taskListCandidate) TaskListItem {
	return TaskListItem{
		Task:           *candidate.Task,
		Classification: candidate.Classification,
		ProjectTitle:   candidate.ProjectTitle,
	}
}

func compareWeekTaskListItem(now time.Time) func(TaskListItem, TaskListItem) int {
	return func(left TaskListItem, right TaskListItem) int {
		return compareDateScope(
			taskListCandidate{Task: &left.Task, Classification: left.Classification},
			taskListCandidate{Task: &right.Task, Classification: right.Classification},
			now,
		)
	}
}

func requestedWeekRange(request WeekRequest) (time.Time, time.Time) {
	containing := request.Containing
	if containing.IsZero() {
		containing = request.Now
	}
	return weekRange(containing, request.Location, request.WeekStart)
}

func weekTaskQuery(request WeekRequest, start time.Time, end time.Time) vikunja.TaskQuery {
	filterParts := appendDueBoundary([]string{"done = false"}, end)
	currentStart, _ := weekRange(request.Now, request.Location, request.WeekStart)
	if start.After(currentStart) {
		filterParts = append(filterParts,
			"(due_date >= '"+start.Format(time.RFC3339)+"' || repeat_after > 0)",
		)
	} else {
		filterParts = append(filterParts, "due_date >= '"+start.Format(time.RFC3339)+"'")
	}
	filterParts = appendProjectFilter(filterParts, request.ProjectID)
	includeNulls := false
	return vikunja.TaskQuery{
		Page: 1, PerPage: 1000, Filter: strings.Join(filterParts, " && "),
		FilterTimezone: request.Timezone, FilterIncludeNulls: &includeNulls,
	}
}

func incompleteWeek(
	start time.Time,
	end time.Time,
	projectID *int64,
	code ListIssueCode,
	cause error,
) WeekResult {
	return WeekResult{
		Start: start, End: end, Days: makeWeekDays(start),
		Issue: &ListIssue{Code: code, ProjectID: projectID, Cause: cause},
	}
}

func weekRange(containing time.Time, location *time.Location, weekStart time.Weekday) (time.Time, time.Time) {
	if weekStart < time.Sunday || weekStart > time.Saturday {
		weekStart = time.Monday
	}
	local := containing.In(location)
	day := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
	daysSinceStart := (int(day.Weekday()) - int(weekStart) + 7) % 7
	start := day.AddDate(0, 0, -daysSinceStart)
	return start, start.AddDate(0, 0, 7)
}

func makeWeekDays(start time.Time) []WeekDay {
	days := make([]WeekDay, 7)
	for index := range days {
		days[index].Date = start.AddDate(0, 0, index)
	}
	return days
}

func appendWeekProjections(
	result *WeekResult,
	source taskListCandidate,
	now time.Time,
	location *time.Location,
) {
	task := source.Task
	if source.Classification.Kind != TaskKindRecurring ||
		(task.RepeatMode != 0 && task.RepeatMode != 1) {
		return
	}

	for due := firstProjectedDue(*task, result.Start); !due.IsZero() && due.Before(result.End); due = nextProjectedDue(*task, due) {
		if due.Before(now) {
			continue
		}
		index := weekDayIndex(result.Start, due, location)
		if index < 0 {
			continue
		}
		result.Days[index].Projections = append(result.Days[index].Projections, WeekProjection{
			Source: TaskListItem{
				Task: *task, Classification: source.Classification, ProjectTitle: source.ProjectTitle,
			},
			DueAt: due, HasDueTime: !source.Classification.DateOnly,
		})
	}
}

func firstProjectedDue(task vikunja.Task, start time.Time) time.Time {
	due := nextProjectedDue(task, task.DueDate)
	if due.IsZero() || !due.Before(start) {
		return due
	}
	if task.RepeatMode == 1 {
		for due.Before(start) {
			due = nextProjectedDue(task, due)
			if due.IsZero() {
				return due
			}
		}
		return due
	}
	step := time.Duration(task.RepeatAfter) * time.Second
	due = start.Add(-(start.Sub(due) % step))
	if due.Before(start) {
		due = due.Add(step)
	}
	return due
}

func nextProjectedDue(task vikunja.Task, due time.Time) time.Time {
	if task.RepeatMode == 1 {
		next := due.AddDate(0, 1, 0)
		if next.After(due) {
			return next
		}
		return time.Time{}
	}
	if task.RepeatAfter <= 0 || task.RepeatAfter > int64(math.MaxInt64/time.Second) {
		return time.Time{}
	}
	next := due.Add(time.Duration(task.RepeatAfter) * time.Second)
	if !next.After(due) {
		return time.Time{}
	}
	return next
}

func weekDayIndex(start time.Time, value time.Time, location *time.Location) int {
	local := value.In(location)
	date := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
	for index := range 7 {
		if start.AddDate(0, 0, index).Equal(date) {
			return index
		}
	}
	return -1
}

func compareWeekProjection(left WeekProjection, right WeekProjection) int {
	if result := left.DueAt.Compare(right.DueAt); result != 0 {
		return result
	}
	if result := cmp.Compare(right.Source.Task.Priority, left.Source.Task.Priority); result != 0 {
		return result
	}
	if result := cmp.Compare(left.Source.Task.Title, right.Source.Task.Title); result != 0 {
		return result
	}
	return cmp.Compare(left.Source.Task.ID, right.Source.Task.ID)
}
