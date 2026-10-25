package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
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

func TestActivityGraphQLRequiresAuthentication(t *testing.T) {
	t.Parallel()
	root := resolver.New(resolver.Dependencies{
		Activity: service.NewPublicActivity(publicActivityReader{}, func() time.Time {
			return time.Date(2026, 10, 15, 13, 0, 0, 0, time.UTC)
		}),
	})
	handler := NewHandler(root, true, discardLogger())
	body := graphQLRequest(t, handler, `{ publicActivity { total } }`).Body.String()
	if !strings.Contains(body, `"errors"`) || !strings.Contains(body, `"UNAUTHENTICATED"`) {
		t.Fatalf("anonymous response = %s", body)
	}
	body = authenticatedActivityRequest(t, root,
		`{ publicActivity { total days { date count completedWithDeadline completedOnTime } } }`).Body.String()
	if !strings.Contains(body, `"total":2`) || strings.Contains(body, "private-user") ||
		!strings.Contains(body, `"completedWithDeadline":2,"completedOnTime":1`) {
		t.Fatalf("authenticated summary: %s", body)
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

func TestActivityAllowsAuthenticatedAccessWhenPublicAccessIsDisabled(t *testing.T) {
	t.Parallel()
	root := resolver.New(resolver.Dependencies{
		Activity: service.NewPublicActivity(publicActivityReader{}, func() time.Time {
			return time.Date(2026, 10, 15, 13, 0, 0, 0, time.UTC)
		}),
	})
	body := authenticatedActivityRequest(t, root, `{ publicActivity { total } }`).Body.String()
	if !strings.Contains(body, `"total":2`) {
		t.Fatalf("authenticated response = %s", body)
	}
}

func authenticatedActivityRequest(
	t *testing.T,
	root *resolver.Resolver,
	query string,
) *httptest.ResponseRecorder {
	t.Helper()
	now := func() time.Time { return time.Date(2026, 10, 15, 13, 0, 0, 0, time.UTC) }
	sessions := auth.NewSessionManager(
		[]byte("01234567890123456789012345678901"),
		now,
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	token, session, err := sessions.Issue()
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(map[string]string{"query": query})
	if err != nil {
		t.Fatal(err)
	}
	cookies := auth.NewSessionCookies(false)
	handler := auth.HTTPContext(sessions, cookies)(
		NewHandler(root, true, discardLogger()),
	)
	request := httptest.NewRequestWithContext(
		t.Context(), http.MethodPost, "http://app.test/graphql", bytes.NewReader(body),
	)
	request.Header.Set("Content-Type", "application/json")
	cookieResponse := httptest.NewRecorder()
	cookies.Set(cookieResponse, token, session.ExpiresAt)
	request.AddCookie(cookieResponse.Result().Cookies()[0])
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}
