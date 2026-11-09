package service

import (
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func buildEditBase(input EditTaskInput, location *time.Location, before vikunja.Task) (vikunja.TaskWrite, bool, error) {
	base := OneTimeInput{Title: input.Title, Description: input.Description, Priority: input.Priority,
		DueDate: input.DueDate, DueTime: input.DueTime}
	if input.PreserveDates.Due {
		base.DueDate, base.DueTime = "", ""
	}
	write, dateOnly, err := BuildOneTimeTask(base, location)
	if err == nil && input.PreserveDates.Due {
		write.DueDate = &before.DueDate
		dateOnly = hasLabel(before.Labels, dateOnlyLabel)
	}
	return write, dateOnly, err
}

func retainedEditTime(value string, location *time.Location, before time.Time, preserve bool) (time.Time, error) {
	if preserve {
		return before, nil
	}
	return editLocalTime(value, location)
}
