package resolver

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestDiscussionRequiresSessionAndCSRFBeforeUpstream(t *testing.T) {
	t.Parallel()
	root, sessions, session, cookie := taskActionResolver(t, &taskActionClientStub{})
	// A nil comment client intentionally makes any premature upstream call fail.
	_, err := (&queryResolver{root}).TaskComments(t.Context(), "1", 1, 50, model.DiscussionOrderAsc)
	assertErrorCode(t, err, "UNAUTHENTICATED")
	_, err = (&queryResolver{root}).TaskComment(t.Context(), "1", "2")
	assertErrorCode(t, err, "UNAUTHENTICATED")
	withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
		for _, ids := range [][2]string{{"0", "2"}, {"1", "-1"}, {"invalid", "2"}} {
			_, err := (&queryResolver{root}).TaskComment(ctx, ids[0], ids[1])
			assertErrorCode(t, err, "VALIDATION_FAILED")
		}
		_, err := (&mutationResolver{root}).CreateTaskComment(ctx, model.CreateTaskCommentInput{TaskID: "1", BodyHTML: "hello"})
		assertErrorCode(t, err, "CSRF_INVALID")
		_, err = (&mutationResolver{root}).UpdateTaskComment(ctx, model.UpdateTaskCommentInput{TaskID: "1", CommentID: "2", BodyHTML: "hello"})
		assertErrorCode(t, err, "CSRF_INVALID")
		_, err = (&mutationResolver{root}).DeleteTaskComment(ctx, model.DeleteTaskCommentInput{TaskID: "1", CommentID: "2"})
		assertErrorCode(t, err, "CSRF_INVALID")
		_, err = (&queryResolver{root}).TaskComments(ctx, "1", 0, 50, model.DiscussionOrderAsc)
		assertErrorCode(t, err, "VALIDATION_FAILED")
		_, err = (&queryResolver{root}).TaskComments(ctx, "1", 1, 101, model.DiscussionOrderAsc)
		assertErrorCode(t, err, "VALIDATION_FAILED")
	})
}

func TestDiscussionErrorMapping(t *testing.T) {
	t.Parallel()
	root := New(Dependencies{})
	for _, test := range []struct {
		status int
		code   string
	}{
		{http.StatusForbidden, "FORBIDDEN"}, {http.StatusUnauthorized, "FORBIDDEN"},
		{http.StatusNotFound, "NOT_FOUND"}, {http.StatusBadRequest, "VALIDATION_FAILED"},
		{http.StatusInternalServerError, "UPSTREAM_REJECTED"},
	} {
		assertErrorCode(t, root.discussionError(&vikunja.Error{Status: test.status}, "Could not save."), test.code)
	}
}

func TestDiscussionUpdateConfirmationFailureIsNotReportedAsWriteRejection(t *testing.T) {
	t.Parallel()
	err := errors.Join(vikunja.ErrCommentUpdateUnconfirmed, &vikunja.Error{Status: http.StatusForbidden})
	assertErrorCode(t, New(Dependencies{}).discussionError(err, "Refresh before retrying."), "UPDATE_UNCONFIRMED")
}

func TestDiscussionReadsOriginalCommentWithoutLoadingPages(t *testing.T) {
	t.Parallel()
	root, sessions, session, cookie := taskActionResolver(t, &taskActionClientStub{})
	root.comments = originalCommentStub{test: t}
	withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
		comment, err := (&queryResolver{root}).TaskComment(ctx, "42", "7")
		if err != nil || comment.ID != "7" || comment.BodyHTML != "original" || comment.Author.ID != "9" {
			t.Fatalf("original comment = %#v, error = %v", comment, err)
		}
	})
}

type originalCommentStub struct {
	commentClient
	test *testing.T
}

func (stub originalCommentStub) TaskComment(_ context.Context, taskID, commentID int64) (vikunja.TaskComment, error) {
	stub.test.Helper()
	if taskID != 42 || commentID != 7 {
		stub.test.Fatalf("original identity = %d/%d", taskID, commentID)
	}
	return vikunja.TaskComment{ID: 7, TaskID: 42, Comment: "original", Author: &vikunja.User{ID: 9}}, nil
}
