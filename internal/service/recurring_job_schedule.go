package service

import (
	"errors"
	"math"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type jobSchedule struct {
	StartAt time.Time
	EndAt   time.Time
	DueAt   time.Time
}

func targetRecurringJobSchedule(
	before vikunja.Task,
	completedAt time.Time,
	location *time.Location,
) (jobSchedule, error) {
	classification := ClassifyTask(before)
	if !classification.Recurring || classification.Kind != TaskKindJob {
		return jobSchedule{}, errors.New("task is not a recurring job")
	}
	if completedAt.IsZero() || location == nil {
		return jobSchedule{}, errors.New("completion time and timezone are required")
	}
	duration := before.EndDate.Sub(before.StartDate)
	completionWindow := before.DueDate.Sub(before.EndDate)
	if before.StartDate.IsZero() || duration <= 0 || completionWindow <= 0 {
		return jobSchedule{}, errors.New("job schedule is invalid")
	}

	start, err := nextRecurringJobStart(before, completedAt, location)
	if err != nil {
		return jobSchedule{}, err
	}
	end, err := addJobScheduleDuration(start, duration)
	if err != nil {
		return jobSchedule{}, err
	}
	due, err := addJobScheduleDuration(end, completionWindow)
	if err != nil {
		return jobSchedule{}, err
	}
	return jobSchedule{StartAt: start, EndAt: end, DueAt: due}, nil
}

func nextRecurringJobStart(
	before vikunja.Task,
	completedAt time.Time,
	location *time.Location,
) (time.Time, error) {
	switch before.RepeatMode {
	case 0:
		step, err := recurrenceDuration(before.RepeatAfter)
		if err != nil {
			return time.Time{}, err
		}
		return advanceAfter(before.StartDate.Add(step), completedAt, step)
	case 1:
		start := before.StartDate.AddDate(0, 1, 0)
		for !start.After(completedAt) {
			next := start.AddDate(0, 1, 0)
			if !next.After(start) {
				return time.Time{}, errors.New("monthly recurrence did not advance")
			}
			start = next
		}
		return start, nil
	case 2:
		if ClassifyTask(before).FixedDueTime {
			return resolveCompletionDateDueTime(completedAt, before.StartDate, before.RepeatAfter, location)
		}
		step, err := recurrenceDuration(before.RepeatAfter)
		if err != nil {
			return time.Time{}, err
		}
		return completedAt.Add(step), nil
	default:
		return time.Time{}, errors.New("recurrence mode is unsupported")
	}
}

func advanceAfter(value time.Time, boundary time.Time, step time.Duration) (time.Time, error) {
	if step <= 0 {
		return time.Time{}, errors.New("recurrence interval is invalid")
	}
	if value.After(boundary) {
		return value, nil
	}
	jumps := int64(boundary.Sub(value)/step) + 1
	if jumps > math.MaxInt64/int64(step) {
		return time.Time{}, errors.New("recurrence schedule is outside the supported range")
	}
	result := value.Add(time.Duration(jumps * int64(step)))
	if !result.After(boundary) || result.Year() < 1 || result.Year() > 9999 {
		return time.Time{}, errors.New("recurrence schedule is outside the supported range")
	}
	return result, nil
}

func recurrenceDuration(seconds int64) (time.Duration, error) {
	if seconds <= 0 || seconds > int64(math.MaxInt64/time.Second) {
		return 0, errors.New("recurrence interval is invalid")
	}
	return time.Duration(seconds) * time.Second, nil
}

func addJobScheduleDuration(value time.Time, duration time.Duration) (time.Time, error) {
	result := value.Add(duration)
	if !result.After(value) || result.Year() < 1 || result.Year() > 9999 {
		return time.Time{}, errors.New("job schedule is outside the supported range")
	}
	return result, nil
}
