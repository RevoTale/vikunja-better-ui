package resolver

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/concurrent"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// Day resolves one local calendar date with the same projection policy as Week.
func (r *queryResolver) Day(ctx context.Context, input model.DayInput) (*model.DayView, error) {
	if _, err := requireSession(ctx); err != nil {
		return nil, err
	}
	userRead := concurrent.Start(func() (vikunja.User, error) { return r.users.CurrentUser(ctx) })
	projectsRead := concurrent.Start(func() ([]vikunja.Project, error) { return r.projects.Projects(ctx) })
	labels, err := r.selectedTaskLabel(ctx, input.LabelID, model.TaskScopeToday)
	if err != nil {
		return nil, err
	}
	user, userErr := userRead.Wait()
	location, err := r.taskLocation(user, userErr)
	if err != nil {
		return nil, err
	}
	now := r.now()
	date, err := selectedCalendarDate(string(input.Date), now, location)
	if err != nil {
		return nil, err
	}
	var projects []vikunja.Project
	if input.ProjectID != nil {
		projects, err = r.waitForTaskProjects(projectsRead)
		if err != nil {
			return nil, err
		}
	}
	projectID, err := selectedProject(input.ProjectID, projects)
	if err != nil {
		return nil, err
	}
	result, err := service.ListDay(ctx, r.tasks, service.WeekRequest{
		Containing: date, Now: now, Location: location, Timezone: user.Settings.Timezone,
		ProjectID: projectID, LabelIDs: labels,
	})
	if err != nil {
		r.logError("list day", err)
		return nil, upstreamClientError(err, "Day tasks could not be loaded.")
	}
	if projects == nil {
		projects, err = r.waitForTaskProjects(projectsRead)
		if err != nil {
			return nil, err
		}
	}
	mapped, err := r.weekViewModel(result, projects, user)
	if err != nil {
		return nil, err
	}
	return &model.DayView{Day: mapped.Days[0], IsComplete: mapped.IsComplete, Issues: mapped.Issues}, nil
}

func selectedCalendarDate(value string, now time.Time, location *time.Location) (time.Time, error) {
	date, err := time.ParseInLocation("2006-01-02", value, location)
	const maxDistanceYears = 10
	if err != nil || date.Before(now.AddDate(-maxDistanceYears, 0, 0)) || date.After(now.AddDate(maxDistanceYears, 0, 0)) {
		return time.Time{}, clientError("VALIDATION_FAILED", "Date must be valid and within ten years of today.")
	}
	return date, nil
}
