package resolver

import (
	"context"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestUpdateTaskRequiresAuthentication(t *testing.T) {
	t.Parallel()
	_, err := (&mutationResolver{New(Dependencies{})}).UpdateTask(t.Context(), model.UpdateTaskInput{})
	assertErrorCode(t, err, "UNAUTHENTICATED")
}

func TestUpdateTaskRejectsInvalidCSRFAndStaleState(t *testing.T) {
	t.Parallel()
	client := &taskActionClientStub{task: vikunja.Task{ID: 9, ProjectID: 7, Title: "Before"}}
	root, sessions, session, cookie := taskActionResolver(t, client)
	withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
		input := model.UpdateTaskInput{TaskID: "9", ProjectID: "7", Priority: model.TaskPriorityUnset, Title: "After", ExpectedVersion: "stale"}
		_, err := (&mutationResolver{root}).UpdateTask(ctx, input)
		assertErrorCode(t, err, "CSRF_INVALID")
		input.CsrfToken = sessions.CSRFToken(session)
		_, err = (&mutationResolver{root}).UpdateTask(ctx, input)
		assertErrorCode(t, err, "CONFLICT")
	})
}

func TestEditErrorsRemainSpecific(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		err  error
		code string
	}{
		{service.ErrTaskNotActive, "TASK_NOT_ACTIVE"},
		{service.ErrTaskNotAccessible, "FORBIDDEN"},
		{service.ErrEditPartial, "EDIT_PARTIAL"},
		{service.ErrInvalidEdit, "VALIDATION_FAILED"},
	} {
		assertErrorCode(t, editClientError(New(Dependencies{}), test.err), test.code)
	}
}
