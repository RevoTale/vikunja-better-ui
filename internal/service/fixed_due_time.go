package service

import (
	"errors"
	"math"
	"time"
)

const recurrenceDaySeconds = int64(24 * time.Hour / time.Second)

func resolveCompletionDateDueTime(
	completedAt time.Time,
	currentDueAt time.Time,
	repeatAfter int64,
	location *time.Location,
) (time.Time, error) {
	if completedAt.IsZero() || currentDueAt.IsZero() {
		return time.Time{}, errors.New("completion and due timestamps are required")
	}
	if location == nil {
		return time.Time{}, errors.New("timezone is required")
	}
	if repeatAfter <= 0 || repeatAfter%recurrenceDaySeconds != 0 {
		return time.Time{}, errors.New("fixed due time requires a whole-day recurrence interval")
	}
	days := repeatAfter / recurrenceDaySeconds
	if days > math.MaxInt32 {
		return time.Time{}, errors.New("recurrence interval is too large")
	}

	completionDate := completedAt.In(location)
	targetDate := completionDate.AddDate(0, 0, int(days))
	if targetDate.Year() < 1 || targetDate.Year() > 9999 {
		return time.Time{}, errors.New("resulting timestamp is outside the supported range")
	}
	clock := currentDueAt.In(location).Format("15:04:05")
	return resolveLocalWallTime(
		targetDate.Format(localDateLayout)+"T"+clock,
		localDateSecondLayout,
		location,
	)
}
