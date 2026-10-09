package resolver

import (
	"context"
	"strconv"

	gqlgen "github.com/99designs/gqlgen/graphql"
	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
)

// Session is the resolver for the session field.
func (r *queryResolver) Session(ctx context.Context) (*model.Session, error) {
	session, ok := auth.SessionFromContext(ctx)
	if !ok {
		return &model.Session{Authenticated: false, Use12HourTime: r.use12HourTime}, nil
	}
	result := authenticatedSessionWithoutUser(r.sessions, session)
	result.Use12HourTime = r.use12HourTime
	if !gqlgen.FieldRequested(ctx, "vikunjaUser") {
		return result, nil
	}
	user, err := r.users.CurrentUser(ctx)
	if err != nil {
		r.logError("read Vikunja user for session", err)
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Vikunja is unavailable. Try again shortly.")
	}
	result.VikunjaUser = vikunjaUserModel(user)
	return result, nil
}

// Projects is the resolver for the projects field.
func (r *queryResolver) Projects(ctx context.Context) (*model.ProjectResult, error) {
	if _, err := requireSession(ctx); err != nil {
		return nil, err
	}
	metadata := r.loadQueryMetadata(ctx)
	if metadata.userErr != nil {
		r.logError("read Vikunja user for projects", metadata.userErr)
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Vikunja is unavailable. Try again shortly.")
	}
	if metadata.projectsErr != nil {
		r.logError("read Vikunja projects", metadata.projectsErr)
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Vikunja projects could not be loaded.")
	}
	items := make([]*model.Project, 0, len(metadata.projects))
	for _, project := range metadata.projects {
		items = append(items, &model.Project{
			ID: strconv.FormatInt(project.ID, 10), Title: project.Title,
			IsDefault: project.ID == metadata.user.Settings.DefaultProjectID,
		})
	}
	return &model.ProjectResult{Items: items}, nil
}
