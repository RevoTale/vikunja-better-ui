package service

import (
	"errors"
	"slices"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func planningCandidateFilter(request ListRequest) string {
	if request.Scope == TaskScopeActive {
		now := request.Now.Format(time.RFC3339Nano)
		return "start_date <= '" + now + "' && (end_date >= '" + now + "' || (repeat_after > 0 && due_date >= '" + now + "'))"
	}
	boundary := request.PeriodBefore
	if request.Scope == TaskScopeToday {
		boundary = nextLocalDay(request.Now, request.Location)
	}
	upper := boundary.Format(time.RFC3339)
	if request.Scope == TaskScopePeriod && !periodHasBacklog(request) {
		return boundedPlanningFilter(request.PeriodFrom, boundary)
	}
	return "(due_date < '" + upper + "' || end_date < '" + upper + "')"
}

func boundedPlanningFilter(from, before time.Time) string {
	lower, upper := from.Format(time.RFC3339), before.Format(time.RFC3339)
	return "((due_date >= '" + lower + "' && due_date < '" + upper +
		"') || (end_date >= '" + lower + "' && end_date < '" + upper + "'))"
}

func validatePlanningPeriod(request ListRequest) error {
	if request.Scope != TaskScopePeriod {
		if !request.PeriodFrom.IsZero() || !request.PeriodBefore.IsZero() {
			return errors.New("period dates are only valid for the period scope")
		}
		return nil
	}
	if request.PeriodFrom.IsZero() || request.PeriodBefore.IsZero() ||
		!request.PeriodFrom.Before(request.PeriodBefore) {
		return errors.New("period must have a start and an end on or after the start")
	}
	return nil
}

func periodHasBacklog(request ListRequest) bool {
	return !request.Now.Before(request.PeriodFrom) && request.Now.Before(request.PeriodBefore)
}

func finishInPeriod(task vikunja.Task, classification TaskClassification, request ListRequest) time.Time {
	finish := time.Time{}
	for _, date := range []time.Time{plannedTaskEnd(task, classification), task.DueDate} {
		if date.IsZero() || !date.Before(request.PeriodBefore) ||
			(date.Before(request.PeriodFrom) && !periodHasBacklog(request)) {
			continue
		}
		if finish.IsZero() || date.Before(finish) {
			finish = date
		}
	}
	return finish
}

func filterPlanningPeriod(candidates []taskListCandidate, request ListRequest) []taskListCandidate {
	filtered := candidates[:0]
	for _, candidate := range candidates {
		if !finishInPeriod(*candidate.Task, candidate.Classification, request).IsZero() {
			filtered = append(filtered, candidate)
		}
	}
	slices.SortFunc(filtered, func(left, right taskListCandidate) int {
		leftTime := finishInPeriod(*left.Task, left.Classification, request)
		rightTime := finishInPeriod(*right.Task, right.Classification, request)
		if result := leftTime.Compare(rightTime); result != 0 {
			return result
		}
		return comparePriorityTitleID(left, right)
	})
	return filtered
}

func orderPlanningCandidates(candidates []taskListCandidate, request ListRequest) []taskListCandidate {
	if request.Scope == TaskScopeActive {
		orderActiveWork(candidates, request.ActiveOrder)
		return candidates
	}
	if request.Scope == TaskScopePeriod {
		return filterPlanningPeriod(candidates, request)
	}
	sortTaskList(candidates, request.Scope, request.Now, request.Location)
	return candidates
}
