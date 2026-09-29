package resolver

import (
	"context"
	"math"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestActionableTaskCountRequiresSession(t *testing.T) {
	t.Parallel()
	_, err := (&queryResolver{New(Dependencies{})}).ActionableTaskCount(t.Context())
	assertErrorCode(t, err, "UNAUTHENTICATED")
}

func TestActionableTaskCountMapsResultsWithoutMetadata(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name  string
		total int64
		err   error
		code  string
	}{
		{name: "empty"},
		{name: "large total", total: 12345},
		{name: "overflow", total: math.MaxInt32 + 1, code: "UPSTREAM_REJECTED"},
		{name: "negative", total: -1, code: "UPSTREAM_REJECTED"},
		{name: "forbidden", err: &vikunja.Error{Status: 403}, code: "UPSTREAM_REJECTED"},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			root, sessions, session, cookie := taskActionResolver(t, &taskActionClientStub{})
			root.tasks = &countClientStub{total: test.total, err: test.err}
			root.users, root.projects = nil, nil
			withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
				count, err := (&queryResolver{root}).ActionableTaskCount(ctx)
				if test.code != "" {
					assertErrorCode(t, err, test.code)
					return
				}
				if err != nil || int64(count) != test.total {
					t.Fatalf("count = %d, error = %v", count, err)
				}
			})
		})
	}
}

type countClientStub struct {
	taskActionClientStub

	total int64
	err   error
}

func (client *countClientStub) TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error) {
	return vikunja.TaskPage{Total: client.total}, client.err
}
