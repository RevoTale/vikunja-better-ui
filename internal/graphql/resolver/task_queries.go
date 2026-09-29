package resolver

import (
	"context"
	"net/http"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/concurrent"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// Tasks is the resolver for the tasks field.
func (r *queryResolver) Tasks(ctx context.Context, input model.TaskListInput) (*model.TaskPage, error) {
	if _, err := requireSession(ctx); err != nil {
		return nil, err
	}
	includeLabels := input.Scope == model.TaskScopeJobs
	userRead := concurrent.Start(func() (vikunja.User, error) { return r.users.CurrentUser(ctx) })
	projectsRead := concurrent.Start(func() ([]vikunja.Project, error) { return r.projects.Projects(ctx) })
	filterLabelIDs, labelErr := r.selectedTaskLabel(ctx, input.LabelID, input.Scope)
	if labelErr != nil {
		return nil, labelErr
	}
	var labelsRead *concurrent.Future[[]vikunja.Label]
	if includeLabels {
		labelsRead = concurrent.Start(func() ([]vikunja.Label, error) { return r.tasks.Labels(ctx) })
	}

	user, userErr := userRead.Wait()
	location, err := r.taskLocation(user, userErr)
	if err != nil {
		return nil, err
	}
	jobLabelIDs, err := r.waitForJobLabels(labelsRead)
	if err != nil {
		return nil, err
	}

	var projects []vikunja.Project
	needsProjectsBeforeTasks := input.ProjectID != nil || input.Scope == model.TaskScopeUnscheduled
	if needsProjectsBeforeTasks {
		projects, err = r.waitForTaskProjects(projectsRead)
		if err != nil {
			return nil, err
		}
	}
	selectedProjectID, err := selectedProject(input.ProjectID, projects)
	if err != nil {
		return nil, err
	}
	result, err := service.ListTasks(ctx, r.tasks, service.ListRequest{
		IncludeCommentCount: true,
		Scope:               service.TaskScope(input.Scope), ProjectID: selectedProjectID,
		Page: input.Page, PageSize: input.PageSize, Now: r.now(),
		Location: location, Timezone: user.Settings.Timezone,
		WeekStart: time.Weekday(user.Settings.WeekStart), ProjectTitles: projectTitleMap(projects),
		JobLabelIDs: jobLabelIDs, FilterLabelIDs: filterLabelIDs,
	})
	if err != nil {
		r.logError("list tasks", err)
		return nil, upstreamClientError(err, "Tasks could not be loaded.")
	}
	if !needsProjectsBeforeTasks {
		projects, err = r.waitForTaskProjects(projectsRead)
		if err != nil {
			return nil, err
		}
	}
	return r.taskPageModel(result, projects, user)
}

// Week is the resolver for the week field.
func (r *queryResolver) Week(ctx context.Context, input model.WeekInput) (*model.WeekView, error) {
	if _, err := requireSession(ctx); err != nil {
		return nil, err
	}
	userRead := concurrent.Start(func() (vikunja.User, error) { return r.users.CurrentUser(ctx) })
	projectsRead := concurrent.Start(func() ([]vikunja.Project, error) { return r.projects.Projects(ctx) })
	user, userErr := userRead.Wait()
	location, err := r.taskLocation(user, userErr)
	if err != nil {
		return nil, err
	}
	now := r.now()
	var containing time.Time
	if input.Containing != nil {
		containing, err = time.ParseInLocation("2006-01-02", string(*input.Containing), location)
		if err != nil {
			return nil, clientError("VALIDATION_FAILED", "Week date is invalid.")
		}
		const maxWeekDistanceYears = 10
		if containing.Before(now.AddDate(-maxWeekDistanceYears, 0, 0)) ||
			containing.After(now.AddDate(maxWeekDistanceYears, 0, 0)) {
			return nil, clientError("VALIDATION_FAILED", "Week date must be within ten years of today.")
		}
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
	result, err := service.ListWeek(ctx, r.tasks, service.WeekRequest{
		Containing: containing, Now: now, Location: location, Timezone: user.Settings.Timezone,
		WeekStart: time.Weekday(user.Settings.WeekStart), ProjectID: projectID,
	})
	if err != nil {
		r.logError("list week", err)
		return nil, upstreamClientError(err, "Week tasks could not be loaded.")
	}
	if projects == nil {
		projects, err = r.waitForTaskProjects(projectsRead)
		if err != nil {
			return nil, err
		}
	}
	return r.weekViewModel(result, projects, user)
}

// Task is the resolver for the task field.
func (r *queryResolver) Task(ctx context.Context, id string) (*model.Task, error) {
	user, projects, _, err := r.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	taskID, err := parsePositiveID(id)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Task ID is invalid.")
	}
	task, _, err := r.tasks.Task(ctx, taskID)
	if err != nil {
		if isUpstreamStatus(err, http.StatusNotFound) {
			return nil, nil
		}
		r.logError("read task", err)
		return nil, upstreamClientError(err, "The task could not be loaded.")
	}
	mapped, err := taskModel(task, projectMap(projects), user.Settings.Timezone, r.now(), user.Settings.DefaultProjectID)
	if err != nil {
		r.logError("map task", err)
		return nil, clientError("UPSTREAM_REJECTED", "The task uses fields this client cannot represent.")
	}
	return mapped, nil
}

// TaskDiagnostics is the resolver for the taskDiagnostics field.
func (r *queryResolver) TaskDiagnostics(ctx context.Context, id string) (*model.TaskDiagnostics, error) {
	_, projects, _, err := r.taskContext(ctx)
	if err != nil {
		return nil, err
	}
	taskID, err := parsePositiveID(id)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Task ID is invalid.")
	}
	task, _, err := r.tasks.Task(ctx, taskID)
	if err != nil {
		if isUpstreamStatus(err, http.StatusNotFound) {
			return nil, nil
		}
		r.logError("read task diagnostics", err)
		return nil, upstreamClientError(err, "Task diagnostics could not be loaded.")
	}
	if _, ok := projectMap(projects)[task.ProjectID]; !ok {
		return nil, clientError("FORBIDDEN", "The task project is not accessible.")
	}
	return diagnosticsModel(task)
}
