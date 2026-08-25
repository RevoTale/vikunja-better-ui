package service

import (
	"cmp"
	"slices"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type TaskScope string

const (
	TaskScopeToday         TaskScope = "TODAY"
	TaskScopeWeek          TaskScope = "WEEK"
	TaskScopeMonth         TaskScope = "MONTH"
	TaskScopeJobs          TaskScope = "JOBS"
	TaskScopeCompletedJobs TaskScope = "COMPLETED_JOBS"
	TaskScopeUnscheduled   TaskScope = "UNSCHEDULED"
	TaskScopeHistory       TaskScope = "HISTORY"
)

type TaskListItem struct {
	Task           vikunja.Task
	Classification TaskClassification
	ProjectTitle   string
}

type taskListCandidate struct {
	Task           *vikunja.Task
	Classification TaskClassification
	ProjectTitle   string
}

func BuildTaskList(
	tasks []vikunja.Task,
	projectTitles map[int64]string,
	scope TaskScope,
	now time.Time,
	location *time.Location,
	weekStart time.Weekday,
) []TaskListItem {
	candidates := make([]taskListCandidate, 0, len(tasks))
	candidates = appendTaskListCandidates(candidates, tasks, projectTitles, scope, now, location, weekStart)
	sortTaskList(candidates, scope, now)
	return materializeTaskList(candidates)
}

func appendTaskListCandidates(
	candidates []taskListCandidate,
	tasks []vikunja.Task,
	projectTitles map[int64]string,
	scope TaskScope,
	now time.Time,
	location *time.Location,
	weekStart time.Weekday,
) []taskListCandidate {
	if location == nil {
		location = time.UTC
	}

	for index := range tasks {
		task := &tasks[index]
		classification := ClassifyTask(*task)
		if !taskMatchesScope(*task, classification, scope, now, location, weekStart) {
			continue
		}
		candidates = append(candidates, taskListCandidate{
			Task:           task,
			Classification: classification,
			ProjectTitle:   projectTitles[task.ProjectID],
		})
	}
	return candidates
}

func materializeTaskList(candidates []taskListCandidate) []TaskListItem {
	items := make([]TaskListItem, len(candidates))
	for index, candidate := range candidates {
		items[index] = TaskListItem{
			Task: *candidate.Task, Classification: candidate.Classification, ProjectTitle: candidate.ProjectTitle,
		}
	}
	return items
}

func taskMatchesScope(
	task vikunja.Task,
	classification TaskClassification,
	scope TaskScope,
	now time.Time,
	location *time.Location,
	weekStart time.Weekday,
) bool {
	switch scope {
	case TaskScopeHistory:
		return task.Done
	case TaskScopeJobs:
		return !task.Done && classification.Kind == TaskKindJob
	case TaskScopeCompletedJobs:
		return task.Done && classification.Kind == TaskKindJob
	case TaskScopeUnscheduled:
		return !task.Done && task.DueDate.IsZero()
	case TaskScopeToday:
		return dueBeforeBoundary(task, nextLocalDay(now, location))
	case TaskScopeWeek:
		return dueBeforeBoundary(task, nextWeekBoundary(now, location, weekStart))
	case TaskScopeMonth:
		return dueBeforeBoundary(task, nextMonthBoundary(now, location))
	default:
		return false
	}
}

func dueBeforeBoundary(task vikunja.Task, boundary time.Time) bool {
	return !task.Done && !task.DueDate.IsZero() && task.DueDate.Before(boundary)
}

func nextLocalDay(now time.Time, location *time.Location) time.Time {
	localNow := now.In(location)
	start := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, location)
	return start.AddDate(0, 0, 1)
}

func nextWeekBoundary(now time.Time, location *time.Location, weekStart time.Weekday) time.Time {
	if weekStart < time.Sunday || weekStart > time.Saturday {
		weekStart = time.Monday
	}
	localNow := now.In(location)
	today := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, location)
	daysSinceStart := (int(localNow.Weekday()) - int(weekStart) + 7) % 7
	return today.AddDate(0, 0, 7-daysSinceStart)
}

func nextMonthBoundary(now time.Time, location *time.Location) time.Time {
	localNow := now.In(location)
	start := time.Date(localNow.Year(), localNow.Month(), 1, 0, 0, 0, 0, location)
	return start.AddDate(0, 1, 0)
}

func sortTaskList(items []taskListCandidate, scope TaskScope, now time.Time) {
	comparison := compareScopedTask(scope, now)
	slices.SortFunc(items, comparison)
}

func compareScopedTask(scope TaskScope, now time.Time) func(taskListCandidate, taskListCandidate) int {
	switch scope {
	case TaskScopeToday:
		return func(left taskListCandidate, right taskListCandidate) int {
			return compareToday(left, right, now)
		}
	case TaskScopeWeek, TaskScopeMonth:
		return func(left taskListCandidate, right taskListCandidate) int {
			return compareDateScope(left, right, now)
		}
	case TaskScopeJobs:
		return func(left taskListCandidate, right taskListCandidate) int {
			return compareJobs(left, right, now)
		}
	case TaskScopeCompletedJobs:
		return compareHistory
	case TaskScopeUnscheduled:
		return compareUnscheduled
	case TaskScopeHistory:
		return compareHistory
	default:
		return func(left taskListCandidate, right taskListCandidate) int {
			return cmp.Compare(left.Task.ID, right.Task.ID)
		}
	}
}

func compareToday(left taskListCandidate, right taskListCandidate, now time.Time) int {
	leftGroup := todayGroup(left, now)
	rightGroup := todayGroup(right, now)
	if result := cmp.Compare(leftGroup, rightGroup); result != 0 {
		return result
	}

	switch leftGroup {
	case 0:
		return comparePriorityDueTitleID(left, right)
	case 1:
		return compareDuePriorityTitleID(left, right)
	default:
		return comparePriorityTitleID(left, right)
	}
}

func todayGroup(item taskListCandidate, now time.Time) int {
	if item.Task.DueDate.Before(now) {
		return 0
	}
	if !item.Classification.DateOnly {
		return 1
	}
	return 2
}

func compareDateScope(left taskListCandidate, right taskListCandidate, now time.Time) int {
	leftOverdue := left.Task.DueDate.Before(now)
	rightOverdue := right.Task.DueDate.Before(now)
	if leftOverdue != rightOverdue {
		if leftOverdue {
			return -1
		}
		return 1
	}
	if leftOverdue {
		return comparePriorityDueTitleID(left, right)
	}
	return compareDuePriorityTitleID(left, right)
}

func compareJobs(left taskListCandidate, right taskListCandidate, now time.Time) int {
	leftOverdue := !left.Task.DueDate.IsZero() && left.Task.DueDate.Before(now)
	rightOverdue := !right.Task.DueDate.IsZero() && right.Task.DueDate.Before(now)
	if leftOverdue != rightOverdue {
		if leftOverdue {
			return -1
		}
		return 1
	}
	if result := compareTimeZeroLast(left.Task.StartDate, right.Task.StartDate); result != 0 {
		return result
	}
	return comparePriorityTitleID(left, right)
}

func compareUnscheduled(left taskListCandidate, right taskListCandidate) int {
	if result := cmp.Compare(left.ProjectTitle, right.ProjectTitle); result != 0 {
		return result
	}
	if result := cmp.Compare(left.Task.ProjectID, right.Task.ProjectID); result != 0 {
		return result
	}
	return comparePriorityTitleID(left, right)
}

func compareHistory(left taskListCandidate, right taskListCandidate) int {
	if result := right.Task.DoneAt.Compare(left.Task.DoneAt); result != 0 {
		return result
	}
	return cmp.Compare(right.Task.ID, left.Task.ID)
}

func comparePriorityDueTitleID(left taskListCandidate, right taskListCandidate) int {
	if result := cmp.Compare(right.Task.Priority, left.Task.Priority); result != 0 {
		return result
	}
	if result := left.Task.DueDate.Compare(right.Task.DueDate); result != 0 {
		return result
	}
	return compareTitleID(left, right)
}

func compareDuePriorityTitleID(left taskListCandidate, right taskListCandidate) int {
	if result := left.Task.DueDate.Compare(right.Task.DueDate); result != 0 {
		return result
	}
	return comparePriorityTitleID(left, right)
}

func comparePriorityTitleID(left taskListCandidate, right taskListCandidate) int {
	if result := cmp.Compare(right.Task.Priority, left.Task.Priority); result != 0 {
		return result
	}
	return compareTitleID(left, right)
}

func compareTitleID(left taskListCandidate, right taskListCandidate) int {
	if result := cmp.Compare(left.Task.Title, right.Task.Title); result != 0 {
		return result
	}
	return cmp.Compare(left.Task.ID, right.Task.ID)
}

func compareTimeZeroLast(left time.Time, right time.Time) int {
	if left.IsZero() != right.IsZero() {
		if left.IsZero() {
			return 1
		}
		return -1
	}
	return left.Compare(right)
}
