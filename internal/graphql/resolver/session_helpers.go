package resolver

import (
	"context"
	"strconv"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func authenticatedSession(manager *auth.SessionManager, session auth.Session, user vikunja.User) *model.Session {
	result := authenticatedSessionWithoutUser(manager, session)
	result.VikunjaUser = vikunjaUserModel(user)
	return result
}

func authenticatedSessionWithoutUser(manager *auth.SessionManager, session auth.Session) *model.Session {
	csrfToken := manager.CSRFToken(session)
	expiresAt := session.ExpiresAt
	return &model.Session{
		Authenticated: true, CsrfToken: &csrfToken, ExpiresAt: &expiresAt,
	}
}

func vikunjaUserModel(user vikunja.User) *model.VikunjaUser {
	var defaultProjectID *string
	if user.Settings.DefaultProjectID > 0 {
		value := strconv.FormatInt(user.Settings.DefaultProjectID, 10)
		defaultProjectID = &value
	}
	return &model.VikunjaUser{
		ID: strconv.FormatInt(user.ID, 10), Username: user.Username,
		Timezone: user.Settings.Timezone, WeekStart: user.Settings.WeekStart,
		DefaultProjectID: defaultProjectID,
	}
}

func requireSession(ctx context.Context) (auth.Session, error) {
	session, ok := auth.SessionFromContext(ctx)
	if !ok {
		return auth.Session{}, clientError("UNAUTHENTICATED", "Log in to continue.")
	}
	return session, nil
}

func (r *Resolver) requireCSRF(ctx context.Context, inputToken string) (auth.Session, error) {
	session, err := requireSession(ctx)
	if err != nil {
		return auth.Session{}, err
	}
	requestInfo, ok := auth.RequestInfoFromContext(ctx)
	if !ok {
		return auth.Session{}, clientError("INTERNAL", "The request context is unavailable.")
	}
	headerToken := requestInfo.Request.Header.Get("X-Csrf-Token")
	if inputToken == "" || inputToken != headerToken || !r.sessions.VerifyCSRF(session, inputToken) {
		return auth.Session{}, clientError("CSRF_INVALID", "Refresh the page and try again.")
	}
	return session, nil
}
