package service

import (
	"cmp"
	"slices"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const daysPerWeek = 7

const (
	todayOverdue = iota
	todayTimed
	todayDateOnly
)

// TaskScope selects a list's filtering and ordering policy.
type TaskScope string

// Supported task scopes include integration-only unified/completed job views.
const (
	TaskScopeRecurring     TaskScope = "RECURRING"
	TaskScopeToday         TaskScope = "TODAY"
	TaskScopeActive        TaskScope = "ACTIVE"
	TaskScopePeriod        TaskScope = "PERIOD"
	TaskScopeWeek          TaskScope = "WEEK"
	TaskScopeMonth         TaskScope = "MONTH"
	TaskScopeJobs          TaskScope = "JOBS"
	TaskScopeCompletedJobs TaskScope = "COMPLETED_JOBS"
	TaskScopeAllJobs       TaskScope = "ALL_JOBS"
	TaskScopeUnscheduled   TaskScope = "UNSCHEDULED"
	TaskScopeLongTerm      TaskScope = "LONG_TERM"
	TaskScopeHistory       TaskScope = "HISTORY"
)

// TaskListItem pairs upstream state with workflow classification and a project title.
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

// BuildTaskList classifies, filters, and sorts supplied tasks without upstream requests.
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
	sortTaskList(candidates, scope, now, location)
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
	case TaskScopeRecurring:
		return !task.Done && classification.Recurring
	case TaskScopeHistory:
		return task.Done
	case TaskScopeJobs, TaskScopeCompletedJobs, TaskScopeAllJobs:
		return matchesJobScope(task, classification, scope)
	case TaskScopeUnscheduled:
		return !task.Done && task.DueDate.IsZero()
	case TaskScopeLongTerm:
		return matchesLongTerm(task, now.In(location))
	case TaskScopeToday:
		return finishBeforeBoundary(task, classification, nextLocalDay(now, location))
	case TaskScopeActive:
		return classification.Kind != TaskKindInvalid && activePlanningWindow(task, now)
	case TaskScopePeriod:
		return !task.Done
	case TaskScopeWeek:
		return dueBeforeBoundary(task, nextWeekBoundary(now, location, weekStart))
	case TaskScopeMonth:
		return dueBeforeBoundary(task, nextMonthBoundary(now, location))
	default:
		return false
	}
}

func matchesJobScope(task vikunja.Task, classification TaskClassification, scope TaskScope) bool {
	if classification.Kind != TaskKindJob {
		return false
	}
	if scope == TaskScopeJobs {
		return !task.Done
	}
	if scope == TaskScopeCompletedJobs {
		return task.Done && !classification.Recurring
	}
	return scope == TaskScopeAllJobs && (!task.Done || !classification.Recurring)
}

func matchesLongTerm(task vikunja.Task, now time.Time) bool {
	return !task.Done && (task.DueDate.IsZero() || task.DueDate.After(now.AddDate(0, 0, daysPerWeek)))
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
	daysSinceStart := (int(localNow.Weekday()) - int(weekStart) + daysPerWeek) % daysPerWeek
	return today.AddDate(0, 0, daysPerWeek-daysSinceStart)
}

func nextMonthBoundary(now time.Time, location *time.Location) time.Time {
	localNow := now.In(location)
	start := time.Date(localNow.Year(), localNow.Month(), 1, 0, 0, 0, 0, location)
	return start.AddDate(0, 1, 0)
}

func sortTaskList(items []taskListCandidate, scope TaskScope, now time.Time, location *time.Location) {
	if location == nil {
		location = time.UTC
	}
	slices.SortFunc(items, compareScopedTask(scope, now, location))
}

func sortAllJobs(items []taskListCandidate, sortBy JobSort, order SortOrder) {
	slices.SortFunc(items, func(left taskListCandidate, right taskListCandidate) int {
		leftTime := left.Task.StartDate
		rightTime := right.Task.StartDate
		if sortBy == JobSortFinishAt {
			leftTime = JobFinishAt(*left.Task)
			rightTime = JobFinishAt(*right.Task)
		}
		if result := compareTimeZeroLastOrdered(leftTime, rightTime, order); result != 0 {
			return result
		}
		result := cmp.Compare(left.Task.ID, right.Task.ID)
		if order == SortDescending {
			return -result
		}
		return result
	})
}

// JobFinishAt returns an active Job's planned finish or a completed Job's actual finish.
func JobFinishAt(task vikunja.Task) time.Time {
	if task.Done {
		return task.DoneAt
	}
	return task.DueDate
}

func compareScopedTask(
	scope TaskScope, now time.Time, location *time.Location,
) func(taskListCandidate, taskListCandidate) int {
	switch scope {
	case TaskScopeRecurring:
		return compareRecurring
	case TaskScopeActive:
		return compareActiveFinish
	case TaskScopeToday:
		return func(left taskListCandidate, right taskListCandidate) int {
			return compareToday(left, right, now, location)
		}
	case TaskScopeWeek, TaskScopeMonth:
		return func(left taskListCandidate, right taskListCandidate) int {
			return compareDateScope(left, right, left.Task.DueDate, right.Task.DueDate, now)
		}
	case TaskScopeJobs:
		return func(left taskListCandidate, right taskListCandidate) int {
			return compareJobs(left, right, now)
		}
	case TaskScopeCompletedJobs:
		return compareHistory
	case TaskScopeUnscheduled:
		return compareUnscheduled
	case TaskScopeLongTerm:
		return compareLongTerm
	case TaskScopeHistory:
		return compareHistory
	case TaskScopeAllJobs, TaskScopePeriod:
		return compareTaskID
	default:
		return compareTaskID
	}
}

func compareTaskID(left taskListCandidate, right taskListCandidate) int {
	return cmp.Compare(left.Task.ID, right.Task.ID)
}

func compareToday(left, right taskListCandidate, now time.Time, location *time.Location) int {
	leftAt := taskFinishAt(*left.Task, left.Classification)
	rightAt := taskFinishAt(*right.Task, right.Classification)
	leftGroup := todayGroup(left, leftAt, now, location)
	rightGroup := todayGroup(right, rightAt, now, location)
	if result := cmp.Compare(leftGroup, rightGroup); result != 0 {
		return result
	}

	switch leftGroup {
	case todayOverdue:
		return comparePriorityDateTitleID(left, right, leftAt, rightAt)
	case todayTimed:
		return compareDatePriorityTitleID(left, right, leftAt, rightAt)
	default:
		return comparePriorityTitleID(left, right)
	}
}

func todayGroup(item taskListCandidate, finish, now time.Time, location *time.Location) int {
	if finish.Before(now) {
		return todayOverdue
	}
	dateOnly := item.Classification.DateOnly
	if !finish.Equal(item.Task.DueDate) {
		const lastHour, lastMinute, lastSecond = 23, 59, 59
		hour, minute, second := finish.In(location).Clock()
		dateOnly = hour == lastHour && minute == lastMinute && second == lastSecond
	}
	if !dateOnly {
		return todayTimed
	}
	return todayDateOnly
}

func compareDateScope(left, right taskListCandidate, leftAt, rightAt, now time.Time) int {
	leftOverdue := leftAt.Before(now)
	rightOverdue := rightAt.Before(now)
	if leftOverdue != rightOverdue {
		if leftOverdue {
			return -1
		}
		return 1
	}
	if leftOverdue {
		return comparePriorityDateTitleID(left, right, leftAt, rightAt)
	}
	return compareDatePriorityTitleID(left, right, leftAt, rightAt)
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
	if leftOverdue {
		return comparePriorityDateTitleID(left, right, left.Task.DueDate, right.Task.DueDate)
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

func compareLongTerm(left taskListCandidate, right taskListCandidate) int {
	if result := compareTimeZeroLast(left.Task.DueDate, right.Task.DueDate); result != 0 {
		return result
	}
	if left.Task.DueDate.IsZero() {
		if result := cmp.Compare(right.Task.Priority, left.Task.Priority); result != 0 {
			return result
		}
	}
	return compareUnscheduled(left, right)
}

func compareHistory(left taskListCandidate, right taskListCandidate) int {
	if result := right.Task.DoneAt.Compare(left.Task.DoneAt); result != 0 {
		return result
	}
	return cmp.Compare(right.Task.ID, left.Task.ID)
}

func comparePriorityDateTitleID(left, right taskListCandidate, leftAt, rightAt time.Time) int {
	if result := cmp.Compare(right.Task.Priority, left.Task.Priority); result != 0 {
		return result
	}
	if result := leftAt.Compare(rightAt); result != 0 {
		return result
	}
	return compareTitleID(left, right)
}

func compareDatePriorityTitleID(left, right taskListCandidate, leftAt, rightAt time.Time) int {
	if result := leftAt.Compare(rightAt); result != 0 {
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

func compareTimeZeroLastOrdered(left time.Time, right time.Time, order SortOrder) int {
	if left.IsZero() != right.IsZero() {
		if left.IsZero() {
			return 1
		}
		return -1
	}
	result := left.Compare(right)
	if order == SortDescending {
		return -result
	}
	return result
}

func compareRecurring(left, right taskListCandidate) int {
	// Calendar months have their own native mode, independent of the seconds interval.
	leftMonthly := left.Task.RepeatMode == vikunja.RepeatModeMonthly
	rightMonthly := right.Task.RepeatMode == vikunja.RepeatModeMonthly
	if leftMonthly != rightMonthly {
		if leftMonthly {
			return 1
		}
		return -1
	}
	if !leftMonthly {
		if result := cmp.Compare(left.Task.RepeatAfter, right.Task.RepeatAfter); result != 0 {
			return result
		}
	}
	if result := compareTimeZeroLast(left.Task.DueDate, right.Task.DueDate); result != 0 {
		return result
	}
	return compareTaskID(left, right)
}
