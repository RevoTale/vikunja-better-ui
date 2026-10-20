package resolver

import (
	"context"
	"errors"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

// PublicAllTimeActivity returns weekly aggregates to sessions or, when enabled, anonymous callers.
func (resolver *queryResolver) PublicAllTimeActivity(ctx context.Context) (*model.PublicAllTimeActivity, error) {
	_, authenticated := auth.SessionFromContext(ctx)
	if resolver.allTimeActivity == nil || (!resolver.publicAllTimeActivityEnabled && !authenticated) {
		return nil, nil
	}
	summary, err := resolver.allTimeActivity.Read(ctx)
	if errors.Is(err, service.ErrActivityBusy) {
		return nil, clientError("RATE_LIMITED", "Activity is busy. Try again shortly.")
	}
	if err != nil {
		resolver.logError("read all-time public activity", err)
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Activity is temporarily unavailable. Try again shortly.")
	}
	result := &model.PublicAllTimeActivity{Total: summary.Total, Timezone: summary.Timezone,
		GeneratedAt: summary.GeneratedAt, RefreshAt: summary.RefreshAt,
		Weeks: make([]*model.ActivityWeek, 0, len(summary.Weeks)),
	}
	for _, week := range summary.Weeks {
		priorities, priorityErr := activityWeekPriorities(week)
		if priorityErr != nil {
			return nil, priorityErr
		}
		result.Weeks = append(result.Weeks, &model.ActivityWeek{Date: week.Date, Count: week.Count,
			CompletedWithDeadline: week.WithDeadlineCount, CompletedOnTime: week.OnTimeCount,
			Priorities: priorities,
		})
	}
	for index, count := range summary.Priorities {
		priority, priorityErr := priorityModel(int64(index))
		if priorityErr != nil {
			return nil, priorityErr
		}
		result.Priorities = append(result.Priorities, &model.ActivityPriority{Priority: priority, Count: count})
	}
	return result, nil
}

func activityWeekPriorities(week service.ActivityWeek) ([]*model.ActivityPriorityTimeliness, error) {
	result := make([]*model.ActivityPriorityTimeliness, 0, len(week.Priorities))
	for index, counts := range week.Priorities {
		if counts.Count == 0 {
			continue
		}
		priority, err := priorityModel(int64(index))
		if err != nil {
			return nil, err
		}
		result = append(result, &model.ActivityPriorityTimeliness{Priority: priority, Count: counts.Count,
			CompletedWithDeadline: counts.WithDeadlineCount, CompletedOnTime: counts.OnTimeCount})
	}
	return result, nil
}
