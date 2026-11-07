package vikunja

import "time"

// TaskReminder is a native absolute or date-relative Vikunja reminder.
type TaskReminder struct {
	Reminder       time.Time `json:"reminder"`
	RelativeTo     string    `json:"relative_to"`
	RelativePeriod int64     `json:"relative_period"`
}
