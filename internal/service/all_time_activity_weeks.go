package service

import (
	"errors"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func activityWeek(instant time.Time, location *time.Location) time.Time {
	local := instant.In(location)
	date := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
	offset := (int(local.Weekday()) + calendarWeekDays - int(time.Monday)) % calendarWeekDays
	return date.AddDate(0, 0, -offset)
}

func addAllTimeActivity(
	summary *AllTimeActivitySummary, weeks map[time.Time]ActivityWeek,
	task vikunja.ActivityTask, now time.Time, location *time.Location,
) error {
	if !task.Done || task.DoneAt.IsZero() || task.DoneAt.After(now) || hasLabel(task.Labels, skippedLabel) {
		return nil
	}
	if task.Priority < 0 || task.Priority >= activityPriorities {
		return vikunja.ErrRejectedResponse
	}
	week := activityWeek(task.DoneAt, location)
	current := activityWeek(now, location)
	if activityDayOffset(week, current, location)/calendarWeekDays >= allTimeMaxWeeks {
		return errors.New("all-time activity week limit exceeded")
	}
	bucket := weeks[week]
	bucket.Count++
	priority := &bucket.Priorities[task.Priority]
	priority.Count++
	if !task.DueDate.IsZero() {
		bucket.WithDeadlineCount++
		priority.WithDeadlineCount++
		if !task.DoneAt.After(task.DueDate) {
			bucket.OnTimeCount++
			priority.OnTimeCount++
		}
	}
	weeks[week] = bucket
	summary.Priorities[task.Priority]++
	summary.Total++
	return nil
}

func fillActivityWeeks(
	summary AllTimeActivitySummary, weeks map[time.Time]ActivityWeek, now time.Time, location *time.Location,
) (AllTimeActivitySummary, error) {
	last := activityWeek(now, location)
	first := last
	for week := range weeks {
		if week.Before(first) {
			first = week
		}
	}
	if len(weeks) == 0 {
		return summary, nil
	}
	count := activityDayOffset(first, last, location)/calendarWeekDays + 1
	if count > allTimeMaxWeeks {
		return AllTimeActivitySummary{}, errors.New("all-time activity week limit exceeded")
	}
	summary.Weeks = make([]ActivityWeek, 0, count)
	for week := first; !week.After(last); week = week.AddDate(0, 0, calendarWeekDays) {
		bucket := weeks[week]
		bucket.Date = week.Format(time.DateOnly)
		summary.Weeks = append(summary.Weeks, bucket)
	}
	return summary, nil
}
