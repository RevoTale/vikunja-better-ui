package resolver

import (
	"context"
	"errors"
	"net/http"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// Login is the resolver for the login field.
func (r *mutationResolver) Login(ctx context.Context, input model.LoginInput) (*model.LoginPayload, error) {
	requestInfo, ok := auth.RequestInfoFromContext(ctx)
	if !ok {
		return nil, clientError("INTERNAL", "The request context is unavailable.")
	}
	if !r.limiter.Allow(requestInfo.ClientIP) {
		return nil, clientError("UNAUTHENTICATED", "Too many sign-in attempts. Try again later.")
	}
	if !auth.ValidAPIToken(input.Token) {
		r.limiter.RecordFailure(requestInfo.ClientIP)
		return nil, clientError("UNAUTHENTICATED", "Enter a valid Vikunja API token.")
	}
	user, err := r.loginUser(ctx, input.Token)
	if err != nil {
		if accessErr := profileAccessError(nil, err); accessErr != nil {
			r.limiter.RecordFailure(requestInfo.ClientIP)
			return nil, accessErr
		}
		if r.logger != nil {
			r.logger.Error("Vikunja profile lookup failed during login")
		}
		return nil, clientError("UPSTREAM_UNAVAILABLE", "Vikunja is unavailable. Try again shortly.")
	}
	token, session, err := r.sessions.Issue(input.Token, requestInfo.Origin)
	if err != nil {
		r.logError("issue app session", err)
		return nil, clientError("INTERNAL", "The session could not be created.")
	}
	requestInfo.ClearSession()
	requestInfo.Cookies.Start(requestInfo.Writer, token, session)
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
	requestInfo.Logout()
	return &model.LogoutPayload{Authenticated: false}, nil
}

func profileAccessError(info *auth.RequestInfo, err error) error {
	upstream, ok := errors.AsType[*vikunja.Error](err)
	if !ok {
		return nil
	}
	switch upstream.Status {
	case http.StatusUnauthorized:
		if info != nil {
			info.ClearSession()
		}
		return clientError("UNAUTHENTICATED", "The Vikunja API token is invalid, expired or revoked.")
	case http.StatusForbidden:
		return clientError("FORBIDDEN", "The token needs permission to read its owner's profile (other:user).")
	default:
		return nil
	}
}
