package main

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/config"
	graphqlserver "github.com/RevoTale/vikunja-better-ui/internal/graphql"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/resolver"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func browserGraphQL(
	c config.Config, logger *slog.Logger, upstream *vikunja.Client, sessions *auth.SessionManager, now func() time.Time,
) http.Handler {
	base := resolver.Dependencies{
		Use12HourTime: c.Use12HourTime, Sessions: sessions, Limiter: auth.NewLoginLimiter(now),
		Capabilities: service.NewCapabilityManager(c.SessionSecret, now), Logger: logger, Now: now,
		ReferencePolicy: service.TaskReferencePolicy{Vikunja: c.VikunjaPublicURL},
		LoginUser: func(ctx context.Context, token string) (vikunja.User, error) {
			return upstream.ForBrowserToken(token).CurrentUser(ctx)
		},
	}
	return graphqlserver.NewRequestHandler(func(ctx context.Context) *resolver.Resolver {
		session, _ := auth.SessionFromContext(ctx)
		client := upstream.ForBrowserToken(session.VikunjaToken())
		deps := base
		if info, ok := auth.RequestInfoFromContext(ctx); ok {
			deps.ReferencePolicy.BetterUI = info.Origin
		}
		deps.Users, deps.Projects, deps.Tasks = client, client, client
		deps.Comments, deps.Attachments, deps.Avatars, deps.Relations = client, client, client, client
		deps.Activity = service.NewCurrentActivity(client, now)
		deps.AllTimeActivity = service.NewCurrentAllTimeActivity(client, now)
		return resolver.New(deps)
	}, c.Environment == config.EnvironmentProduction, logger)
}
