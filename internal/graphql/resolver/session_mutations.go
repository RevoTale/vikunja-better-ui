package resolver

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
)

// Login is the resolver for the login field.
func (r *mutationResolver) Login(ctx context.Context, input model.LoginInput) (*model.LoginPayload, error) {
	requestInfo, ok := auth.RequestInfoFromContext(ctx)
	if !ok {
		return nil, clientError("INTERNAL", "The request context is unavailable.")
	}
	if !r.limiter.Allow(requestInfo.ClientIP) {
		return nil, clientError("UNAUTHENTICATED", "Invalid username or password.")
	}
	if err := r.credentials.Verify(input.Username, input.Password); err != nil {
		r.limiter.RecordFailure(requestInfo.ClientIP)
		return nil, clientError("UNAUTHENTICATED", "Invalid username or password.")
	}
	user, err := r.users.CurrentUser(ctx)
	if err != nil {
		r.logError("verify Vikunja access during login", err)
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Vikunja is unavailable. Try again shortly.")
	}
	token, session, err := r.sessions.Issue()
	if err != nil {
		r.logError("issue app session", err)
		return nil, clientError("INTERNAL", "The session could not be created.")
	}
	r.cookies.Set(requestInfo.Writer, token, session.ExpiresAt)
	r.limiter.RecordSuccess(requestInfo.ClientIP)
	result := authenticatedSession(r.sessions, session, user)
	result.Use12HourTime = r.use12HourTime
	return &model.LoginPayload{Session: result}, nil
}

// Logout is the resolver for the logout field.
func (r *mutationResolver) Logout(ctx context.Context, csrfToken string) (*model.LogoutPayload, error) {
	if _, err := r.requireCSRF(ctx, csrfToken); err != nil {
		return nil, err
	}
	requestInfo, ok := auth.RequestInfoFromContext(ctx)
	if !ok {
		return nil, clientError("INTERNAL", "The request context is unavailable.")
	}
	r.cookies.Clear(requestInfo.Writer)
	return &model.LogoutPayload{Authenticated: false}, nil
}
