package resolver

import (
	"context"
	"math"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

// ActionableTaskCount resolves the navigation count without loading user or project metadata.
func (r *queryResolver) ActionableTaskCount(ctx context.Context) (int, error) {
	if _, err := requireSession(ctx); err != nil {
		return 0, err
	}
	count, err := service.CountActionableTasks(ctx, r.tasks, r.now())
	if err != nil {
		r.logError("count actionable tasks", err)
		return 0, upstreamClientError(err, "The task count could not be loaded.")
	}
	if count < 0 || count > math.MaxInt32 {
		return 0, clientError("UPSTREAM_REJECTED", "The task count is outside the supported range.")
	}
	return int(count), nil
}
