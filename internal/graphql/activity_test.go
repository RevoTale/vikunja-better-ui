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
	return vikunja.ActivityPage{TotalPages: 1}, nil
}

func TestPublicActivityAnonymousBoundary(t *testing.T) {
	t.Parallel()
	root := resolver.New(resolver.Dependencies{
		Activity: service.NewPublicActivity(publicActivityReader{}, time.Now),
	})
	handler := NewHandler(root, true, discardLogger())
	response := graphQLRequest(t, handler, `{ publicActivity { total days { date count } } }`)
	if body := response.Body.String(); !strings.Contains(body, `"total":0`) || strings.Contains(body, "private-user") {
		t.Fatalf("public summary: %s", body)
	}
	for _, query := range []string{
		`{ publicActivity(from: "2000-01-01") { total } }`,
		`{ publicActivity { username } }`,
		`{ task(id: "1") { title } }`,
	} {
		if body := graphQLRequest(t, handler, query).Body.String(); !strings.Contains(body, `"errors"`) {
			t.Fatalf("unsafe query accepted: %s", body)
		}
	}
}
