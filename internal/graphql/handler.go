package graphql

import (
	"context"
	"log/slog"

	gqlgen "github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/generated"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/resolver"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

const (
	maxOperationComplexity = 200
	maxOperationDepth      = 12
)

func NewHandler(root *resolver.Resolver, production bool, logger *slog.Logger) *handler.Server {
	server := handler.New(generated.NewExecutableSchema(generated.Config{Resolvers: root}))
	server.AddTransport(transport.POST{})
	server.Use(extension.FixedComplexityLimit(maxOperationComplexity))
	server.AroundOperations(operationBoundary(production))
	server.SetRecoverFunc(func(_ context.Context, recovered any) error {
		logger.Error("GraphQL resolver panic", "cause", recovered)
		return resolverInternalError()
	})
	return server
}

func operationBoundary(production bool) gqlgen.OperationMiddleware {
	return func(ctx context.Context, next gqlgen.OperationHandler) gqlgen.ResponseHandler {
		operation := gqlgen.GetOperationContext(ctx)
		if production {
			if _, authenticated := auth.SessionFromContext(ctx); !authenticated {
				operation.DisableIntrospection = true
			}
		}
		if operationDepth(operation) > maxOperationDepth {
			return func(context.Context) *gqlgen.Response {
				return gqlgen.ErrorResponse(ctx, "operation exceeds the maximum depth")
			}
		}
		return next(ctx)
	}
}

func operationDepth(operation *gqlgen.OperationContext) int {
	if operation.Operation == nil || operation.Doc == nil {
		return 0
	}
	return selectionDepth(operation.Operation.SelectionSet, operation.Doc, map[string]bool{})
}

func selectionDepth(selections ast.SelectionSet, document *ast.QueryDocument, visiting map[string]bool) int {
	maximum := 0
	for _, selection := range selections {
		depth := 1
		switch selected := selection.(type) {
		case *ast.Field:
			depth += selectionDepth(selected.SelectionSet, document, visiting)
		case *ast.InlineFragment:
			depth = selectionDepth(selected.SelectionSet, document, visiting)
		case *ast.FragmentSpread:
			if visiting[selected.Name] {
				continue
			}
			fragment := document.Fragments.ForName(selected.Name)
			if fragment != nil {
				visiting[selected.Name] = true
				depth = selectionDepth(fragment.SelectionSet, document, visiting)
				delete(visiting, selected.Name)
			}
		}
		if depth > maximum {
			maximum = depth
		}
	}
	return maximum
}

func resolverInternalError() error {
	return &gqlerror.Error{Message: "An internal error occurred.", Extensions: map[string]any{"code": "INTERNAL"}}
}
