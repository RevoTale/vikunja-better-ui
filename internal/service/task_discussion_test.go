package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestLoadTaskDiscussionPreservesUpstreamOrder(t *testing.T) {
	createdLater := time.Date(2026, 9, 22, 12, 0, 0, 0, time.UTC)
	createdEarlier := createdLater.Add(-time.Hour)
	reader := discussionReaderStub{comments: []vikunja.TaskComment{
		{ID: 2, TaskID: 42, Comment: "later", Created: createdLater, Author: &vikunja.User{ID: 8, Username: "author"}},
		{ID: 1, TaskID: 42, Comment: "earlier", Created: createdEarlier, Author: &vikunja.User{ID: 8, Username: "author"}},
	}}

	discussion, err := LoadTaskDiscussion(context.Background(), reader, 42, vikunja.CommentQuery{Page: 1, PerPage: 50, Order: "desc"})
	if err != nil {
		t.Fatalf("LoadTaskDiscussion() error = %v", err)
	}
	if len(discussion.Comments) != 2 || discussion.Comments[0].ID != 2 || discussion.Comments[1].ID != 1 {
		t.Fatalf("comments = %#v, want upstream order", discussion.Comments)
	}
}

func TestLoadTaskDiscussionRejectsInvalidComment(t *testing.T) {
	reader := discussionReaderStub{comments: []vikunja.TaskComment{{
		ID: 1, TaskID: 42, Comment: "body", Author: nil,
	}}}

	_, err := LoadTaskDiscussion(context.Background(), reader, 42, vikunja.CommentQuery{Page: 1, PerPage: 50, Order: "asc"})
	if !errors.Is(err, ErrInvalidComment) {
		t.Fatalf("LoadTaskDiscussion() error = %v, want ErrInvalidComment", err)
	}
}

type discussionReaderStub struct {
	comments []vikunja.TaskComment
}

func (stub discussionReaderStub) TaskComments(context.Context, int64, vikunja.CommentQuery) (vikunja.CommentPage, error) {
	return vikunja.CommentPage{Items: stub.comments, Page: 1, PerPage: 50, TotalPages: 1}, nil
}
