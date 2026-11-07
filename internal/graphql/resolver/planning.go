package resolver

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

func activeWorkOrder(input *model.ActiveWorkOrderInput) service.ActiveWorkOrder {
	if input == nil {
		return service.ActiveWorkOrder{}
	}
	return service.ActiveWorkOrder{Sort: service.ActiveWorkSort(input.Sort), RevisitFirst: input.RevisitFirst}
}

func planningWindowInput(input *model.PlanningWindowInput) *service.PlanningWindowInput {
	if input == nil {
		return nil
	}
	return &service.PlanningWindowInput{
		StartsOn: string(input.StartsOn), EndsOn: string(input.EndsOn), EndsAtTime: optionalLocalTime(input.EndsAtTime),
		StartsAtTime: optionalLocalTime(input.StartsAtTime),
	}
}

func planningPeriod(input model.TaskListInput, location *time.Location) (time.Time, time.Time, error) {
	if input.Scope != model.TaskScopePeriod {
		if input.From != nil || input.Through != nil {
			return time.Time{}, time.Time{}, clientError("VALIDATION_FAILED", "Period dates require the period view.")
		}
		return time.Time{}, time.Time{}, nil
	}
	if input.From == nil || input.Through == nil {
		return time.Time{}, time.Time{}, clientError("VALIDATION_FAILED", "Choose both period dates.")
	}
	start, startErr := service.ResolveLocalDateTime(string(*input.From)+"T00:00", location)
	end, endErr := service.ResolveDateOnly(string(*input.Through), location)
	if startErr != nil || endErr != nil || end.Before(start) || end.Add(time.Second).Year() > 9999 {
		return time.Time{}, time.Time{}, clientError("VALIDATION_FAILED", "Choose a valid period with end on or after start.")
	}
	return start, end.Add(time.Second), nil
}

// TodayTaskCount uses the same bounded, fresh query and completion policy as Today.
func (r *queryResolver) TodayTaskCount(ctx context.Context) (int, error) {
	if _, err := requireSession(ctx); err != nil {
		return 0, err
	}
	user, userErr := r.users.CurrentUser(ctx)
	location, err := r.taskLocation(user, userErr)
	if err != nil {
		return 0, err
	}
	result, err := service.ListTasks(ctx, r.tasks, service.ListRequest{
		Scope: service.TaskScopeToday, Page: 1, PageSize: 1, Now: r.now(),
		Location: location, Timezone: user.Settings.Timezone,
	})
	if err != nil {
		r.logError("count today's tasks", err)
		return 0, upstreamClientError(err, "Today's task count could not be loaded.")
	}
	if !result.IsComplete {
		return 0, clientError("UPSTREAM_PARTIAL", "Today's task count could not be confirmed.")
	}
	return int(result.TotalItems), nil
}
