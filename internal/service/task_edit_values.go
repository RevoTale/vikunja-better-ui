package service

import (
	"errors"
	"time"
	"unicode/utf8"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

var ErrInvalidEdit = errors.New("invalid task edit")

func BuildEditedTask(input EditTaskInput, location *time.Location) (vikunja.TaskWrite, map[string]bool, error) {
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
	if utf8.RuneCountInString(write.Title) > 250 {
		return write, nil, errors.Join(ErrInvalidEdit, errors.New("title must contain at most 250 characters"))
	}
	start, err := editLocalTime(input.StartLocal, location)
	if err != nil {
		return write, nil, errors.Join(ErrInvalidEdit, err)
	}
	end, err := editLocalTime(input.EndLocal, location)
	if err != nil {
		return write, nil, errors.Join(ErrInvalidEdit, err)
	}
	write.StartDate, write.EndDate = &start, &end
	if write.DueDate == nil {
		write.DueDate = new(time.Time)
	}
	if !start.IsZero() && !end.IsZero() && !end.After(start) {
		return write, nil, errors.Join(ErrInvalidEdit, errors.New("end must be after start"))
	}
	if input.Job && (start.IsZero() || end.IsZero() || dateOnly || !write.DueDate.After(end)) {
		return write, nil, errors.Join(ErrInvalidEdit, errors.New("a job requires start before end before timed due"))
	}
	keep := false
	if input.Recurrence != nil {
		rule := *input.Recurrence
		if write.DueDate.IsZero() {
			return write, nil, errors.Join(ErrInvalidEdit, errors.New("recurrence requires a due date"))
		}
		recurrence, ruleErr := BuildIntervalRecurrence(rule.Interval, rule.Unit, rule.Mode)
		if ruleErr != nil {
			return write, nil, errors.Join(ErrInvalidEdit, ruleErr)
		}
		write.RepeatAfter, write.RepeatMode = recurrence.RepeatAfter, recurrence.RepeatMode
		keep = rule.KeepDueTime
		if keep && (dateOnly || rule.Mode != RecurrenceModeFromCompletion || rule.Unit == RecurrenceUnitMonth) {
			return write, nil, errors.Join(ErrInvalidEdit, errors.New("fixed time requires a timed day or week recurrence from completion"))
		}
	}
	return write, map[string]bool{jobLabel: input.Job, dateOnlyLabel: dateOnly, fixedDueTimeLabel: keep}, nil
}

func editLocalTime(value string, location *time.Location) (time.Time, error) {
	if value == "" {
		return time.Time{}, nil
	}
	return ResolveLocalDateTime(value, location)
}
