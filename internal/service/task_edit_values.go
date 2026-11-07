package service

import (
	"errors"
	"time"
	"unicode/utf8"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// ErrInvalidEdit identifies an edit that cannot form a valid task schedule.
var ErrInvalidEdit = errors.New("invalid task edit")

const maxTaskTitleCharacters = 250

// BuildEditedTask resolves local times and validates the requested workflow before writing.
func BuildEditedTask(input EditTaskInput, location *time.Location) (vikunja.TaskWrite, map[string]bool, error) {
	return buildEditedTask(input, location, vikunja.Task{})
}

func buildEditedTask(
	input EditTaskInput, location *time.Location, before vikunja.Task,
) (vikunja.TaskWrite, map[string]bool, error) {
	write, dateOnly, err := BuildOneTimeTask(OneTimeInput{
		Title: input.Title, Description: input.Description, Priority: input.Priority,
		DueDate: input.DueDate, DueTime: input.DueTime,
	}, location)
	if err != nil {
		return write, nil, errors.Join(ErrInvalidEdit, err)
	}
	if input.Priority < 0 || input.Priority > 5 {
		return write, nil, ErrInvalidEdit
	}
	if utf8.RuneCountInString(write.Title) > maxTaskTitleCharacters {
		return write, nil, errors.Join(ErrInvalidEdit, errors.New("title must contain at most 250 characters"))
	}
	if err := applyEditedDates(&write, input, location); err != nil {
		return write, nil, errors.Join(ErrInvalidEdit, err)
	}
	if write.DueDate == nil {
		write.DueDate = new(time.Time)
	}
	// Resolve unchanged minutes against the stored instants before checking their order.
	if input.Planning == nil {
		preserveEditPrecision(write.StartDate, before.StartDate)
		preserveEditPrecision(write.EndDate, before.EndDate)
	}
	if hasLabel(before.Labels, dateOnlyLabel) == dateOnly {
		preserveEditPrecision(write.DueDate, before.DueDate)
	}
	if err := validateEditedSchedule(*write.StartDate, *write.EndDate, *write.DueDate, input.Job, dateOnly); err != nil {
		return write, nil, errors.Join(ErrInvalidEdit, err)
	}
	keep, err := applyEditRecurrence(&write, input.Recurrence, dateOnly)
	if err != nil {
		return write, nil, errors.Join(ErrInvalidEdit, err)
	}
	markers := map[string]bool{jobLabel: input.Job, dateOnlyLabel: dateOnly, fixedDueTimeLabel: keep}
	if err := retainRecurringAvailability(before, input, write, markers); err != nil {
		return write, nil, errors.Join(ErrInvalidEdit, err)
	}
	return write, markers, nil
}

func retainRecurringAvailability(
	before vikunja.Task, input EditTaskInput, write vikunja.TaskWrite, markers map[string]bool,
) error {
	if !hasLabel(before.Labels, recurringAvailabilityLabel) || input.Job || input.Recurrence == nil ||
		write.StartDate.IsZero() || !write.EndDate.IsZero() {
		return nil
	}
	if write.StartDate.After(*write.DueDate) {
		return errors.New("available from must be on or before the due date")
	}
	markers[recurringAvailabilityLabel] = true
	return nil
}

func applyEditedDates(write *vikunja.TaskWrite, input EditTaskInput, location *time.Location) error {
	if input.Planning != nil {
		if input.Job || input.Recurrence != nil {
			return errors.New("planning windows require a one-time task")
		}
		return applyPlanningWindow(write, input.Planning, location)
	}
	start, err := editLocalTime(input.StartLocal, location)
	if err != nil {
		return err
	}
	end, err := editLocalTime(input.EndLocal, location)
	if err != nil {
		return err
	}
	write.StartDate, write.EndDate = &start, &end
	return nil
}

func validateEditedSchedule(start, end, due time.Time, job, dateOnly bool) error {
	if !start.IsZero() && !end.IsZero() && !end.After(start) {
		return errors.New("end must be after start")
	}
	if job && (start.IsZero() || end.IsZero() || dateOnly || !due.After(end)) {
		return errors.New("a job requires start before end before timed due")
	}
	return nil
}

func applyEditRecurrence(write *vikunja.TaskWrite, rule *RecurringInput, dateOnly bool) (bool, error) {
	if rule == nil {
		return false, nil
	}
	if write.DueDate.IsZero() {
		return false, errors.New("recurrence requires a due date")
	}
	recurrence, err := BuildIntervalRecurrence(rule.Interval, rule.Unit, rule.Mode)
	if err != nil {
		return false, err
	}
	write.RepeatAfter, write.RepeatMode = recurrence.RepeatAfter, recurrence.RepeatMode
	if rule.KeepDueTime && (dateOnly || rule.Mode != RecurrenceModeFromCompletion || rule.Unit == RecurrenceUnitMonth) {
		return false, errors.New("fixed time requires a timed day or week recurrence from completion")
	}
	return rule.KeepDueTime, nil
}

func editLocalTime(value string, location *time.Location) (time.Time, error) {
	if value == "" {
		return time.Time{}, nil
	}
	return ResolveLocalDateTime(value, location)
}
