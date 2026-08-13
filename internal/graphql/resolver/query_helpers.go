package resolver

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func (resolver *Resolver) taskContext(ctx context.Context) (vikunja.User, []vikunja.Project, *time.Location, error) {
	if _, err := requireSession(ctx); err != nil {
		return vikunja.User{}, nil, nil, err
	}
	user, err := resolver.users.CurrentUser(ctx)
	if err != nil {
		resolver.logError("read Vikunja user for tasks", err)
		return vikunja.User{}, nil, nil, clientError("UPSTREAM_UNAVAILABLE", "Vikunja is unavailable.")
	}
	location, err := time.LoadLocation(user.Settings.Timezone)
	if err != nil || user.Settings.Timezone == "" {
		return vikunja.User{}, nil, nil, clientError(
			"VALIDATION_FAILED", "Configure a valid timezone in Vikunja before using date-sensitive views.",
		)
	}
	projects, err := resolver.projects.Projects(ctx)
	if err != nil {
		resolver.logError("read Vikunja projects for tasks", err)
		return vikunja.User{}, nil, nil, clientError("UPSTREAM_UNAVAILABLE", "Vikunja projects could not be loaded.")
	}
	return user, projects, location, nil
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
		return 0, fmt.Errorf("ID must be a positive integer")
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

func exactLabelIDs(labels []vikunja.Label, title string) []int64 {
	result := make([]int64, 0)
	for _, label := range labels {
		if label.Title == title && label.ID > 0 {
			result = append(result, label.ID)
		}
	}
	slices.Sort(result)
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

func diagnosticsModel(task vikunja.Task, timezone string) (*model.TaskDiagnostics, error) {
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
		Priority: int(task.Priority), RecurrenceRule: recurrence, Labels: labels,
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
	var upstreamError *vikunja.Error
	if errors.As(err, &upstreamError) {
		return clientError("UPSTREAM_REJECTED", fallback)
	}
	return clientError("UPSTREAM_UNAVAILABLE", fallback)
}
