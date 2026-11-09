package mcp

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestListRequestRejectsPageOverflow(t *testing.T) {
	t.Parallel()
	for _, scope := range []service.TaskScope{service.TaskScopeToday, service.TaskScopeRecurring} {
		_, err := listRequest(listInput{Scope: scope, Page: int(^uint(0) >> 1), PageSize: 100},
			time.Now(), vikunja.User{}, time.UTC)
		if err == nil {
			t.Fatal("overflowing page accepted")
		}
	}
}

func TestCompletedJobScopesCarryBoundsAndOrdering(t *testing.T) {
	t.Parallel()
	for _, scope := range []service.TaskScope{service.TaskScopeCompletedJobs, service.TaskScopeAllJobs} {
		input := listInput{Scope: scope, From: "2026-11-01", Through: "2026-11-09"}
		request, err := listRequest(input, time.Now(), vikunja.User{}, time.UTC)
		if err != nil {
			t.Fatal(err)
		}
		if request.CompletedFrom.Format(time.DateOnly) != "2026-11-01" ||
			request.CompletedBefore.Format(time.DateOnly) != "2026-11-10" ||
			request.JobSort != service.JobSortStartAt || request.SortOrder != service.SortAscending {
			t.Fatalf("invalid jobs request: %#v", request)
		}
	}
}
