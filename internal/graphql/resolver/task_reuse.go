package resolver

import (
	"context"
	"strconv"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

func (r *queryResolver) TaskReuseValues(ctx context.Context, job bool, recurring bool) (*model.TaskReuseValues, error) {
	if _, err := requireSession(ctx); err != nil {
		return nil, err
	}
	user, err := r.users.CurrentUser(ctx)
	if err != nil {
		return nil, upstreamClientError(err, "Previous task could not be loaded.")
	}
	task, err := service.LatestCreatedTask(ctx, r.tasks, user.ID, job, recurring)
	if err != nil {
		return nil, upstreamClientError(err, "Previous task could not be loaded.")
	}
	if task == nil {
		return nil, nil
	}
	location, err := time.LoadLocation(user.Settings.Timezone)
	if err != nil || user.Settings.Timezone == "" {
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Previous task has an invalid timezone.")
	}
	priority, err := priorityModel(task.Priority)
	if err != nil {
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Previous task has an unsupported priority.")
	}
	result := &model.TaskReuseValues{
		TaskID:    strconv.FormatInt(task.ID, 10),
		Title:     task.Title,
		ProjectID: strconv.FormatInt(task.ProjectID, 10),
		Priority:  priority,
		Labels:    []*model.Label{},
	}
	result.DueDate, result.DueTime = reuseSchedule(task.DueDate, location, service.ClassifyTask(*task).DateOnly)
	result.StartDate, result.StartTime = reuseSchedule(task.StartDate, location, false)
	for _, label := range task.Labels {
		if !service.IsInternalLabel(label.Title) {
			result.Labels = append(result.Labels, &model.Label{ID: strconv.FormatInt(label.ID, 10), Title: label.Title})
		}
	}
	if job {
		result.DurationMinutes = reuseMinutes(task.StartDate, task.EndDate)
		result.CompletionWindowMinutes = reuseMinutes(task.EndDate, task.DueDate)
	}
	return result, nil
}

func reuseSchedule(instant time.Time, location *time.Location, dateOnly bool) (*model.LocalDate, *model.LocalTime) {
	if instant.IsZero() {
		return nil, nil
	}
	local := instant.In(location)
	date := model.LocalDate(local.Format(time.DateOnly))
	if dateOnly {
		return &date, nil
	}
	clock := model.LocalTime(local.Format("15:04"))
	return &date, &clock
}

func reuseMinutes(start, end time.Time) *int {
	if start.IsZero() || end.IsZero() || !end.After(start) {
		return nil
	}
	duration := end.Sub(start)
	if duration%time.Minute != 0 || duration/time.Minute > 2147483647 {
		return nil
	}
	minutes := int(duration / time.Minute)
	return &minutes
}
