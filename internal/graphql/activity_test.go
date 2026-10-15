package graphql

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/resolver"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type publicActivityReader struct{}

func (publicActivityReader) CurrentUser(context.Context) (vikunja.User, error) {
	return vikunja.User{Username: "private-user", Settings: vikunja.UserSettings{Timezone: "UTC"}}, nil
}

func (publicActivityReader) ActivityPage(context.Context, vikunja.TaskQuery) (vikunja.ActivityPage, error) {
	instant := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	return vikunja.ActivityPage{TotalPages: 1, Items: []vikunja.ActivityTask{
		{Done: true, DoneAt: instant, DueDate: instant},
		{Done: true, DoneAt: instant, DueDate: instant.Add(-time.Hour)},
	}}, nil
}

func TestPublicActivityAnonymousBoundary(t *testing.T) {
	t.Parallel()
	root := resolver.New(resolver.Dependencies{
		Activity: service.NewPublicActivity(publicActivityReader{}, func() time.Time {
			return time.Date(2026, 10, 15, 13, 0, 0, 0, time.UTC)
		}),
	})
	handler := NewHandler(root, true, discardLogger())
	response := graphQLRequest(t, handler,
		`{ publicActivity { total days { date count completedWithDeadline completedOnTime } } }`)
	body := response.Body.String()
	if !strings.Contains(body, `"total":2`) || strings.Contains(body, "private-user") ||
		!strings.Contains(body, `"completedWithDeadline":2,"completedOnTime":1`) {
		t.Fatalf("public summary: %s", body)
	}
	for _, query := range []string{
		`{ publicActivity(from: "2000-01-01") { total } }`,
		`{ publicActivity { username } }`,
		`{ publicActivity { days { dueDate taskId } } }`,
		`{ task(id: "1") { title } }`,
	} {
		if body := graphQLRequest(t, handler, query).Body.String(); !strings.Contains(body, `"errors"`) {
			t.Fatalf("unsafe query accepted: %s", body)
		}
	}
}
