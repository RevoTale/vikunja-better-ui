package resolver

import (
	"context"
	"errors"
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/concurrent"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type queryMetadata struct {
	user        vikunja.User
	projects    []vikunja.Project
	userErr     error
	projectsErr error
}

func (resolver *Resolver) loadQueryMetadata(ctx context.Context) queryMetadata {
	var metadata queryMetadata
	var waitGroup sync.WaitGroup
	waitGroup.Go(func() { metadata.user, metadata.userErr = resolver.users.CurrentUser(ctx) })
	waitGroup.Go(func() { metadata.projects, metadata.projectsErr = resolver.projects.Projects(ctx) })
	waitGroup.Wait()
	return metadata
}

func (resolver *Resolver) taskContext(ctx context.Context) (vikunja.User, []vikunja.Project, *time.Location, error) {
	if _, err := requireSession(ctx); err != nil {
		return vikunja.User{}, nil, nil, err
	}
	metadata := resolver.loadQueryMetadata(ctx)
	location, err := resolver.taskLocation(metadata.user, metadata.userErr)
	if err != nil {
		return vikunja.User{}, nil, nil, err
	}
	if metadata.projectsErr != nil {
		resolver.logError("read Vikunja projects for tasks", metadata.projectsErr)
		return vikunja.User{}, nil, nil, clientError(
			"UPSTREAM_UNAVAILABLE", "Vikunja projects could not be loaded.",
		)
	}
	return metadata.user, metadata.projects, location, nil
}

func (resolver *Resolver) taskLocation(user vikunja.User, userErr error) (*time.Location, error) {
	if userErr != nil {
		resolver.logError("read Vikunja user for tasks", userErr)
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Vikunja is unavailable.")
	}
	location, err := time.LoadLocation(user.Settings.Timezone)
	if err != nil || user.Settings.Timezone == "" {
		return nil, clientError(
			"VALIDATION_FAILED", "Configure a valid timezone in Vikunja before using date-sensitive views.",
		)
	}
	return location, nil
}

func (resolver *Resolver) waitForTaskProjects(
	projectsRead *concurrent.Future[[]vikunja.Project],
) ([]vikunja.Project, error) {
	projects, err := projectsRead.Wait()
	if err != nil {
		resolver.logError("read Vikunja projects for tasks", err)
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Vikunja projects could not be loaded.")
	}
	return projects, nil
}

func selectedProject(value *string, projects []vikunja.Project) (*int64, error) {
	if value == nil {
		return nil, nil
	}
	projectID, err := parsePositiveID(*value)
	if err != nil {
		return nil, clientError("VALIDATION_FAILED", "Project ID is invalid.")
	}
	for _, project := range projects {
		if project.ID == projectID {
			return &projectID, nil
		}
	}
	return nil, clientError("FORBIDDEN", "The selected project is not accessible.")
}

func parsePositiveID(value string) (int64, error) {
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return 0, errors.New("ID must be a positive integer")
	}
	return parsed, nil
}

func projectMap(projects []vikunja.Project) map[int64]vikunja.Project {
	result := make(map[int64]vikunja.Project, len(projects))
	for _, project := range projects {
		result[project.ID] = project
	}
	return result
}

func projectTitleMap(projects []vikunja.Project) map[int64]string {
	result := make(map[int64]string, len(projects))
	for _, project := range projects {
		result[project.ID] = project.Title
	}
	return result
}

func taskPageIssueModel(issue *service.ListIssue) *model.TaskPageIssue {
	code := model.PageIssueCodeUpstreamPartial
	message := "Vikunja stopped before the complete task set was loaded. Try again."
	if issue.Code == service.ListIssueTooLarge {
		code = model.PageIssueCodeResultSetTooLarge
		message = "Select a project or a narrower view to load fewer than 10,001 tasks."
	}
	var projectID *string
	if issue.ProjectID != nil {
		value := strconv.FormatInt(*issue.ProjectID, 10)
		projectID = &value
	}
	return &model.TaskPageIssue{Code: code, Message: message, ProjectID: projectID}
}

func (resolver *Resolver) taskPageModel(
	result service.ListResult,
	projects []vikunja.Project,
	user vikunja.User,
) (*model.TaskPage, error) {
	if result.TotalItems > math.MaxInt32 || result.TotalPages > math.MaxInt32 {
		return nil, clientError("UPSTREAM_REJECTED", "Vikunja returned more history than this client can represent.")
	}
	projectByID := projectMap(projects)
	items := make([]*model.Task, 0, len(result.Items))
	for _, item := range result.Items {
		mapped, err := taskModel(
			item.Task,
			projectByID,
			user.Settings.Timezone,
			resolver.now(),
			user.Settings.DefaultProjectID,
		)
		if err != nil {
			resolver.logError("map Vikunja task", err)
			return nil, clientError("UPSTREAM_REJECTED", "A Vikunja task uses fields this client cannot represent.")
		}
		items = append(items, mapped)
	}
	issues := make([]*model.TaskPageIssue, 0, 1)
	if result.Issue != nil {
		issues = append(issues, taskPageIssueModel(result.Issue))
	}
	return &model.TaskPage{
		Items: items, Page: result.Page, PageSize: result.PageSize,
		TotalItems: int(result.TotalItems), TotalPages: int(result.TotalPages),
		HasMore: result.HasMore, IsComplete: result.IsComplete, Issues: issues,
	}, nil
}

func (resolver *Resolver) weekViewModel(
	result service.WeekResult,
	projects []vikunja.Project,
	user vikunja.User,
) (*model.WeekView, error) {
	projectByID := projectMap(projects)
	mapItem := func(item service.TaskListItem) (*model.Task, error) {
		return taskModel(
			item.Task, projectByID, user.Settings.Timezone, resolver.now(), user.Settings.DefaultProjectID,
		)
	}
	mapItems := func(items []service.TaskListItem) ([]*model.Task, error) {
		mapped := make([]*model.Task, 0, len(items))
		for _, item := range items {
			task, err := mapItem(item)
			if err != nil {
				return nil, err
			}
			mapped = append(mapped, task)
		}
		return mapped, nil
	}

	days := make([]*model.WeekDay, 0, len(result.Days))
	for _, day := range result.Days {
		tasks, mapErr := mapItems(day.Items)
		if mapErr != nil {
			return nil, weekMappingError(resolver, mapErr)
		}
		projections := make([]*model.WeekProjection, 0, len(day.Projections))
		for _, projection := range day.Projections {
			source, mapErr := mapItem(projection.Source)
			if mapErr != nil {
				return nil, weekMappingError(resolver, mapErr)
			}
			projections = append(projections, &model.WeekProjection{
				SourceTask: source, DueAt: projection.DueAt, HasDueTime: projection.HasDueTime,
			})
		}
		days = append(days, &model.WeekDay{
			Date: model.LocalDate(day.Date.Format("2006-01-02")), Tasks: tasks, Projections: projections,
		})
	}
	issues := make([]*model.TaskPageIssue, 0, 1)
	if result.Issue != nil {
		issues = append(issues, taskPageIssueModel(result.Issue))
	}
	return &model.WeekView{
		StartsOn: model.LocalDate(result.Start.Format("2006-01-02")),
		EndsOn:   model.LocalDate(result.End.AddDate(0, 0, -1).Format("2006-01-02")),
		Days:     days, IsComplete: result.IsComplete, Issues: issues,
	}, nil
}

func weekMappingError(resolver *Resolver, err error) error {
	resolver.logError("map Vikunja week task", err)
	return clientError("UPSTREAM_REJECTED", "A Vikunja task uses fields this client cannot represent.")
}

func diagnosticsModel(task vikunja.Task, timezone string) (*model.TaskDiagnostics, error) {
	priority, err := priorityModel(task.Priority)
	if err != nil {
		return nil, clientError("UPSTREAM_REJECTED", "The task priority is unsupported.")
	}
	recurrence, err := recurrenceRuleModel(task)
	if err != nil {
		return nil, clientError("UPSTREAM_REJECTED", "The task recurrence fields are unsupported.")
	}
	labels := make([]*model.Label, 0, len(task.Labels))
	for _, label := range task.Labels {
		labels = append(labels, &model.Label{ID: strconv.FormatInt(label.ID, 10), Title: label.Title})
	}
	var creator *model.CreatorDiagnostic
	if task.CreatedBy.ID > 0 {
		creator = &model.CreatorDiagnostic{
			ID: strconv.FormatInt(task.CreatedBy.ID, 10), Username: task.CreatedBy.Username, Name: task.CreatedBy.Name,
		}
	}
	var permission *string
	if task.MaxPermission != nil {
		value := permissionName(*task.MaxPermission)
		permission = &value
	}
	return &model.TaskDiagnostics{
		ID: strconv.FormatInt(task.ID, 10), ProjectID: strconv.FormatInt(task.ProjectID, 10),
		Title: task.Title, Kind: taskKindModel(service.ClassifyTask(task).Kind), IsDone: task.Done,
		DoneAt: optionalTime(task.DoneAt), DueAt: optionalTime(task.DueDate),
		StartAt: optionalTime(task.StartDate), EndAt: optionalTime(task.EndDate),
		Priority: priority, RecurrenceRule: recurrence, Labels: labels,
		CreatedAt: task.Created, UpdatedAt: task.Updated, Creator: creator, MaxPermission: permission,
	}, nil
}

func permissionName(value int) string {
	switch value {
	case 0:
		return "READ"
	case 1:
		return "WRITE"
	case 2:
		return "ADMIN"
	default:
		return "UNKNOWN"
	}
}

func isUpstreamStatus(err error, status int) bool {
	var upstreamError *vikunja.Error
	return errors.As(err, &upstreamError) && upstreamError.Status == status
}

func upstreamClientError(err error, fallback string) error {
	if isUpstreamStatus(err, http.StatusPreconditionFailed) {
		return clientError("CONFLICT", "The task changed. Refresh and try again.")
	}
	if _, ok := errors.AsType[*vikunja.Error](err); ok {
		return clientError("UPSTREAM_REJECTED", fallback)
	}
	return clientError("UPSTREAM_UNAVAILABLE", fallback)
}
