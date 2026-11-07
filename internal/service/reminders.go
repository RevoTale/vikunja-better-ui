package service

import (
	"errors"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// ReminderInput preserves an existing instant or resolves a new local date/time.
type ReminderInput struct {
	At             *time.Time
	LocalAt        string
	RelativeTo     string
	RelativePeriod int64
}

// BuildReminders validates native reminders; nil preserves and an empty list clears.
func BuildReminders(
	inputs []ReminderInput, task vikunja.TaskWrite, location *time.Location,
) (*[]vikunja.TaskReminder, error) {
	if inputs == nil {
		return nil, nil
	}
	reminders := make([]vikunja.TaskReminder, 0, len(inputs))
	seen := make(map[int64]bool, len(inputs))
	for _, input := range inputs {
		reminder, err := resolveReminder(input, task, location)
		if err != nil {
			return nil, err
		}
		key := reminder.Reminder.Unix()
		if seen[key] {
			return nil, errors.New("reminders must not trigger at the same second")
		}
		seen[key] = true
		reminders = append(reminders, reminder)
	}
	return &reminders, nil
}

func resolveReminder(
	input ReminderInput, task vikunja.TaskWrite, location *time.Location,
) (vikunja.TaskReminder, error) {
	result := vikunja.TaskReminder{RelativeTo: input.RelativeTo, RelativePeriod: input.RelativePeriod}
	if input.RelativeTo != "" {
		return resolveRelativeReminder(input, task)
	}
	if input.RelativePeriod != 0 || (input.At == nil) == (input.LocalAt == "") {
		return result, errors.New("choose a reminder date and time")
	}
	if input.At != nil {
		result.Reminder = *input.At
	} else {
		at, err := ResolveLocalDateTime(input.LocalAt, location)
		if err != nil {
			return result, errors.Join(errors.New("invalid reminder time"), err)
		}
		result.Reminder = at
	}
	if result.Reminder.IsZero() || result.Reminder.Year() < 1 || result.Reminder.Year() > 9999 {
		return result, errors.New("invalid reminder date")
	}
	return result, nil
}

// RemindersMatch compares confirmation irrespective of Vikunja's timestamp ordering.
func RemindersMatch(actual []vikunja.TaskReminder, expected *[]vikunja.TaskReminder) bool {
	if expected == nil {
		return true
	}
	if len(actual) != len(*expected) {
		return false
	}
	found := make(map[vikunja.TaskReminder]bool, len(actual))
	for _, item := range actual {
		item.Reminder = item.Reminder.UTC()
		found[item] = true
	}
	for _, item := range *expected {
		item.Reminder = item.Reminder.UTC()
		if !found[item] {
			return false
		}
	}
	return true
}

func resolveRelativeReminder(input ReminderInput, task vikunja.TaskWrite) (vikunja.TaskReminder, error) {
	result := vikunja.TaskReminder{RelativeTo: input.RelativeTo, RelativePeriod: input.RelativePeriod}
	anchors := map[string]*time.Time{"start_date": task.StartDate, "end_date": task.EndDate, "due_date": task.DueDate}
	anchor, ok := anchors[input.RelativeTo]
	if !ok || input.LocalAt != "" || input.RelativePeriod < -2147483648 || input.RelativePeriod > 2147483647 {
		return result, errors.New("invalid relative reminder")
	}
	if anchor != nil && !anchor.IsZero() {
		result.Reminder = anchor.Add(time.Duration(input.RelativePeriod) * time.Second)
		if result.Reminder.Year() < 1 || result.Reminder.Year() > 9999 {
			return result, errors.New("relative reminder is outside the supported date range")
		}
	}
	return result, nil
}
