package resolver

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestDeleteTaskRequiresCSRF(t *testing.T) {
	t.Parallel()

	root := New(Dependencies{})
	_, err := (&mutationResolver{root}).DeleteTask(context.Background(), model.DeleteTaskInput{
		CsrfToken: "invalid",
		TaskID:    "9",
	})
	assertErrorCode(t, err, "UNAUTHENTICATED")
}

func TestDeleteTaskDeletesAccessibleActiveTask(t *testing.T) {
	t.Parallel()

	client := &taskActionClientStub{task: vikunja.Task{ID: 9, ProjectID: 7, Title: "Active"}}
	root, sessions, session, cookie := taskActionResolver(t, client)

	withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
		payload, err := (&mutationResolver{root}).DeleteTask(ctx, model.DeleteTaskInput{
			CsrfToken: sessions.CSRFToken(session),
			TaskID:    "9",
		})
		if err != nil {
			t.Fatalf("DeleteTask() error = %v", err)
		}
		if payload.DeletedTaskID != "9" || client.deletedTaskID != 9 {
			t.Fatalf("DeleteTask() = %#v, deleted task ID = %d", payload, client.deletedTaskID)
		}
	})
}

func TestDeleteTaskMapsCompletedTaskToStableError(t *testing.T) {
	t.Parallel()

	client := &taskActionClientStub{task: vikunja.Task{ID: 9, ProjectID: 7, Title: "Done", Done: true}}
	root, sessions, session, cookie := taskActionResolver(t, client)

	withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
		_, err := (&mutationResolver{root}).DeleteTask(ctx, model.DeleteTaskInput{
			CsrfToken: sessions.CSRFToken(session),
			TaskID:    "9",
		})
		assertErrorCode(t, err, "TASK_NOT_ACTIVE")
		if client.deletedTaskID != 0 {
			t.Fatalf("deleted task ID = %d", client.deletedTaskID)
		}
	})
}

func withTaskActionContext(
	t *testing.T,
	sessions *auth.SessionManager,
	session auth.Session,
	cookie *http.Cookie,
	action func(context.Context),
) {
	t.Helper()
	handler := auth.HTTPContext(sessions, auth.NewSessionCookies(false))(http.HandlerFunc(
		func(_ http.ResponseWriter, request *http.Request) {
			action(request.Context())
		},
	))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "http://app.test/graphql", nil)
	request.Header.Set("X-CSRF-Token", sessions.CSRFToken(session))
	request.AddCookie(cookie)
	handler.ServeHTTP(httptest.NewRecorder(), request)
}

func taskActionResolver(
	t *testing.T,
	client *taskActionClientStub,
) (*Resolver, *auth.SessionManager, auth.Session, *http.Cookie) {
	t.Helper()

	now := time.Date(2026, time.August, 14, 12, 0, 0, 0, time.UTC)
	sessions := auth.NewSessionManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	token, session, err := sessions.Issue()
	if err != nil {
		t.Fatal(err)
	}
	reader := &resolverReaderStub{
		user:     vikunja.User{ID: 1, Username: "user", Settings: vikunja.UserSettings{Timezone: "UTC", DefaultProjectID: 7}},
		projects: []vikunja.Project{{ID: 7, Title: "Home"}},
	}
	root := New(Dependencies{
		Sessions: sessions, Users: reader, Projects: reader, Tasks: client,
		Now: func() time.Time { return now },
	})
	cookie := &http.Cookie{
		Name: "vbu_session", Value: token, HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	}
	return root, sessions, session, cookie
}

type taskActionClientStub struct {
	task          vikunja.Task
	deletedTaskID int64
}

func (client *taskActionClientStub) TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error) {
	return vikunja.TaskPage{}, nil
}

func (client *taskActionClientStub) Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	return client.task, vikunja.ResponseMetadata{ETag: `"v1"`}, nil
}

func (client *taskActionClientStub) CreateTask(context.Context, int64, vikunja.TaskWrite) (vikunja.Task, error) {
	return vikunja.Task{}, nil
}

func (client *taskActionClientStub) CreateTaskHTML(context.Context, int64, vikunja.TaskWrite) (vikunja.Task, error) {
	return vikunja.Task{}, nil
}

func (client *taskActionClientStub) PatchTask(context.Context, int64, vikunja.TaskPatch, string) (vikunja.Task, error) {
	return vikunja.Task{}, nil
}

func (client *taskActionClientStub) PatchTaskChecked(
	context.Context,
	int64,
	vikunja.TaskPatch,
	vikunja.TaskCheck,
) (vikunja.Task, error) {
	return vikunja.Task{}, nil
}

func (client *taskActionClientStub) DeleteTask(_ context.Context, taskID int64) error {
	client.deletedTaskID = taskID
	return nil
}

func (client *taskActionClientStub) Labels(context.Context) ([]vikunja.Label, error) {
	return nil, nil
}

func (client *taskActionClientStub) CreateLabel(context.Context, vikunja.LabelWrite) (vikunja.Label, error) {
	return vikunja.Label{}, nil
}

func (client *taskActionClientStub) AttachLabel(context.Context, int64, int64) error {
	return nil
}
