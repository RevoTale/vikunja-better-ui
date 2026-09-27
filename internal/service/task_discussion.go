package service

import (
	"context"
	"errors"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

var ErrInvalidComment = errors.New("vikunja returned an invalid task comment")

type CommentReader interface {
	TaskComments(context.Context, int64, vikunja.CommentQuery) (vikunja.CommentPage, error)
}

type DiscussionComment struct {
	ID        int64
	BodyHTML  string
	Author    DiscussionAuthor
	CreatedAt time.Time
	UpdatedAt time.Time
}

type DiscussionAuthor struct {
	ID       int64
	Username string
	Name     string
}

type TaskDiscussion struct {
	TaskID     int64
	Comments   []DiscussionComment
	Page       int64
	PageSize   int64
	TotalPages int64
}

func LoadTaskDiscussion(ctx context.Context, reader CommentReader, taskID int64, query vikunja.CommentQuery) (TaskDiscussion, error) {
	if taskID <= 0 {
		return TaskDiscussion{}, errors.New("task ID must be positive")
	}
	page, err := reader.TaskComments(ctx, taskID, query)
	if err != nil {
		return TaskDiscussion{}, err
	}

	result := make([]DiscussionComment, 0, len(page.Items))
	for _, comment := range page.Items {
		if comment.ID <= 0 || comment.TaskID != taskID || comment.Comment == "" || comment.Author == nil || comment.Author.ID <= 0 {
			return TaskDiscussion{}, ErrInvalidComment
		}
		result = append(result, DiscussionComment{
			ID: comment.ID, BodyHTML: comment.Comment,
			Author:    DiscussionAuthor{ID: comment.Author.ID, Username: comment.Author.Username, Name: comment.Author.Name},
			CreatedAt: comment.Created, UpdatedAt: comment.Updated,
		})
	}
	return TaskDiscussion{TaskID: taskID, Comments: result, Page: page.Page, PageSize: page.PerPage, TotalPages: page.TotalPages}, nil
}
