package service

import (
	"context"
	"slices"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// ListDay loads one local date using the same bounded source and projection rules as Week.
func ListDay(ctx context.Context, client taskListClient, request WeekRequest) (WeekResult, error) {
	request.singleDay = true
	return ListWeek(ctx, client, request)
}

// BuildDayView projects supplied tasks onto one date without mutating their source occurrences.
func BuildDayView(tasks []vikunja.Task, request WeekRequest) WeekResult {
	request.singleDay = true
	return BuildWeekView(tasks, request)
}

func matchesCalendarLabels(task vikunja.Task, ids []int64) bool {
	if len(ids) == 0 {
		return true
	}
	for _, label := range task.Labels {
		if slices.Contains(ids, label.ID) {
			return true
		}
	}
	return false
}
