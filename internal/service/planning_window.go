package service

import (
	"errors"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// PlanningWindowInput is an inclusive pair of local calendar dates, stored in native timestamps.
type PlanningWindowInput struct {
	StartsAtTime string
	EndsAtTime   string
	StartsOn     string
	EndsOn       string
}

func applyPlanningWindow(write *vikunja.TaskWrite, window *PlanningWindowInput, location *time.Location) error {
	if window == nil {
		return nil
	}
	if window.StartsOn == "" || window.EndsOn == "" || window.EndsOn < window.StartsOn {
		return errors.New("planning window requires a start and a finish on or after the start")
	}
	clock := window.StartsAtTime
	if clock == "" {
		clock = "00:00"
	}
	start, err := ResolveLocalDateTime(window.StartsOn+"T"+clock, location)
	if err != nil {
		return err
	}
	end, err := planningFinish(window, location)
	if err != nil {
		return err
	}
	if write.DueDate != nil && !write.DueDate.IsZero() &&
		window.EndsOn > write.DueDate.In(location).Format(localDateLayout) {
		return errors.New("planned finish must not be after the hard deadline date")
	}
	if !end.After(start) {
		return errors.New("planned finish must be after start")
	}
	write.StartDate, write.EndDate = &start, &end
	return nil
}

func planningFinish(window *PlanningWindowInput, location *time.Location) (time.Time, error) {
	if window.EndsAtTime == "" {
		return ResolveDateOnly(window.EndsOn, location)
	}
	return ResolveLocalDateTime(window.EndsOn+"T"+window.EndsAtTime, location)
}

func plannedTaskEnd(task vikunja.Task, classification TaskClassification) time.Time {
	if classification.Kind != TaskKindOneTime {
		return time.Time{}
	}
	return task.EndDate
}

func taskFinishAt(task vikunja.Task, classification TaskClassification) time.Time {
	end := plannedTaskEnd(task, classification)
	if !end.IsZero() && (task.DueDate.IsZero() || end.Before(task.DueDate)) {
		return end
	}
	return task.DueDate
}

func finishBeforeBoundary(task vikunja.Task, classification TaskClassification, boundary time.Time) bool {
	finish := taskFinishAt(task, classification)
	return !task.Done && !finish.IsZero() && finish.Before(boundary)
}

func activePlanningWindow(task vikunja.Task, now time.Time) bool {
	end := activeWindowEnd(&task)
	return !task.Done && !task.StartDate.IsZero() && !end.IsZero() &&
		!task.StartDate.After(now) && !end.Before(now) &&
		(end.After(task.StartDate) || (task.EndDate.IsZero() && end.Equal(task.StartDate)))
}

func activeWindowEnd(task *vikunja.Task) time.Time {
	if task.EndDate.IsZero() && task.RepeatAfter > 0 && hasLabel(task.Labels, recurringAvailabilityLabel) {
		return task.DueDate
	}
	return task.EndDate
}

func resolveAvailabilityDay(value string, location *time.Location) (time.Time, error) {
	day, err := time.Parse(localDateLayout, value)
	if err != nil || location == nil {
		return time.Time{}, errors.New("invalid availability date or timezone")
	}
	start, err := firstAvailableLocalDay(day, location)
	if err != nil || start.In(location).Format(localDateLayout) != value {
		return time.Time{}, errors.New("availability date does not exist in the selected timezone")
	}
	return start, nil
}

func validateChangedPlanningDates(
	before vikunja.Task, write vikunja.TaskWrite, input EditTaskInput, location *time.Location,
) error {
	if input.Job || input.Recurrence != nil || write.EndDate.IsZero() || write.DueDate.IsZero() {
		return nil
	}
	if write.EndDate.Equal(before.EndDate) && write.DueDate.Equal(before.DueDate) &&
		write.StartDate.Equal(before.StartDate) {
		return nil
	}
	end, due := write.EndDate.In(location), write.DueDate.In(location)
	if end.Format(localDateLayout) > due.Format(localDateLayout) {
		return errors.New("planned finish must not be after the hard deadline date")
	}
	return nil
}
