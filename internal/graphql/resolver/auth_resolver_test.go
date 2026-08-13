package resolver

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

func TestLoginCreatesAuthenticatedSession(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	sessions := auth.NewSessionManager(
		[]byte("01234567890123456789012345678901"), func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	reader := &resolverReaderStub{user: vikunja.User{
		ID: 4, Username: "vikunja-user",
		Settings: vikunja.UserSettings{Timezone: "Europe/Kyiv", WeekStart: 1, DefaultProjectID: 7},
	}}
	root := New(Dependencies{
		Credentials: auth.NewCredentials("app-user", "app-password"),
		Sessions:    sessions, Cookies: auth.NewSessionCookies(false), Limiter: auth.NewLoginLimiter(func() time.Time { return now }),
		Users: reader, Projects: reader, Now: func() time.Time { return now },
	})

	recorder := httptest.NewRecorder()
	withRequestContext(t, sessions, auth.NewSessionCookies(false), recorder, nil, func(ctx context.Context) {
		payload, err := (&mutationResolver{root}).Login(ctx, model.LoginInput{Username: "app-user", Password: "app-password"})
		if err != nil {
			t.Fatalf("Login() error = %v", err)
		}
		if !payload.Session.Authenticated || payload.Session.CsrfToken == nil || payload.Session.VikunjaUser.Timezone != "Europe/Kyiv" {
			t.Fatalf("Login() = %#v", payload)
		}
	})
	if len(recorder.Result().Cookies()) != 1 || !recorder.Result().Cookies()[0].HttpOnly {
		t.Fatalf("cookies = %#v", recorder.Result().Cookies())
	}
}

func TestLoginReturnsGenericAuthenticationError(t *testing.T) {
	t.Parallel()

	now := time.Now()
	sessions := auth.NewSessionManager(
		[]byte("01234567890123456789012345678901"), func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	reader := &resolverReaderStub{}
	root := New(Dependencies{
		Credentials: auth.NewCredentials("app-user", "app-password"),
		Sessions:    sessions, Cookies: auth.NewSessionCookies(false), Limiter: auth.NewLoginLimiter(func() time.Time { return now }),
		Users: reader, Projects: reader,
	})

	withRequestContext(t, sessions, auth.NewSessionCookies(false), httptest.NewRecorder(), nil, func(ctx context.Context) {
		_, err := (&mutationResolver{root}).Login(ctx, model.LoginInput{Username: "wrong", Password: "wrong"})
		assertErrorCode(t, err, "UNAUTHENTICATED")
	})
}

func TestProjectsRequireSessionAndMarkAccessibleDefault(t *testing.T) {
	t.Parallel()

	root := New(Dependencies{Users: &resolverReaderStub{}, Projects: &resolverReaderStub{}})
	_, err := (&queryResolver{root}).Projects(context.Background())
	assertErrorCode(t, err, "UNAUTHENTICATED")

	now := time.Now()
	sessions := auth.NewSessionManager(
		[]byte("01234567890123456789012345678901"), func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	token, _, err := sessions.Issue()
	if err != nil {
		t.Fatal(err)
	}
	reader := &resolverReaderStub{
		user:     vikunja.User{ID: 1, Username: "user", Settings: vikunja.UserSettings{DefaultProjectID: 8}},
		projects: []vikunja.Project{{ID: 7, Title: "Home"}, {ID: 8, Title: "Work"}},
	}
	root = New(Dependencies{Users: reader, Projects: reader})
	cookie := &http.Cookie{
		Name: "vbu_session", Value: token, Secure: true,
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
	}
	withRequestContext(t, sessions, auth.NewSessionCookies(false), httptest.NewRecorder(), cookie, func(ctx context.Context) {
		result, queryErr := (&queryResolver{root}).Projects(ctx)
		if queryErr != nil {
			t.Fatalf("Projects() error = %v", queryErr)
		}
		if len(result.Items) != 2 || result.Items[0].IsDefault || !result.Items[1].IsDefault {
			t.Fatalf("Projects() = %#v", result)
		}
	})
}

type resolverReaderStub struct {
	user     vikunja.User
	projects []vikunja.Project
}

func (reader *resolverReaderStub) CurrentUser(context.Context) (vikunja.User, error) {
	return reader.user, nil
}

func (reader *resolverReaderStub) Projects(context.Context) ([]vikunja.Project, error) {
	return reader.projects, nil
}

func withRequestContext(
	t *testing.T,
	sessions *auth.SessionManager,
	cookies auth.SessionCookies,
	recorder *httptest.ResponseRecorder,
	cookie *http.Cookie,
	action func(context.Context),
) {
	t.Helper()
	handler := auth.HTTPContext(sessions, cookies)(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		action(request.Context())
	}))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "http://app.test/graphql", nil)
	request.RemoteAddr = "192.0.2.1:1234"
	if cookie != nil {
		request.AddCookie(cookie)
	}
	handler.ServeHTTP(recorder, request)
}

func assertErrorCode(t *testing.T, err error, want string) {
	t.Helper()
	var gqlErr *gqlerror.Error
	ok := errors.As(err, &gqlErr)
	if !ok || gqlErr.Extensions["code"] != want {
		t.Fatalf("error = %#v, want code %s", err, want)
	}
}
