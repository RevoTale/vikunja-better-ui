package service

import (
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// ApplyCreationStartNow replaces automatic availability with the server instant.
// Unscheduled tasks and already-ended windows retain their existing boundaries.
func ApplyCreationStartNow(write *vikunja.TaskWrite, now time.Time) {
	if write.StartDate == nil || write.StartDate.IsZero() || now.IsZero() {
		return
	}
	finish := write.EndDate
	if finish == nil || finish.IsZero() {
		finish = write.DueDate
	}
	instant := now.Truncate(time.Second)
	if finish != nil && instant.Before(*finish) {
		write.StartDate = &instant
	}
}
