package graphql

import (
	"context"
	"log/slog"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/resolver"
)

// NewHandler serves a fixed resolver fixture through the production GraphQL pipeline.
func NewHandler(root *resolver.Resolver, production bool, logger *slog.Logger) *handler.Server {
	return NewRequestHandler(func(context.Context) *resolver.Resolver { return root }, production, logger)
}
