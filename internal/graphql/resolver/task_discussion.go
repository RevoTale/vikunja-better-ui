package resolver

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func discussionCommentModel(comment service.DiscussionComment) *model.TaskComment {
	return &model.TaskComment{
		ID: strconv.FormatInt(comment.ID, 10), BodyHTML: comment.BodyHTML,
		Author:    &model.DiscussionAuthor{ID: strconv.FormatInt(comment.Author.ID, 10), Username: comment.Author.Username, Name: comment.Author.Name},
		CreatedAt: comment.CreatedAt, UpdatedAt: comment.UpdatedAt,
	}
}

func discussionPageModel(result service.TaskDiscussion) (*model.TaskCommentPage, error) {
	if result.TotalPages > math.MaxInt32 || result.Page > math.MaxInt32 {
		return nil, clientError("UPSTREAM_REJECTED", "The discussion is too large to display.")
	}
	items := make([]*model.TaskComment, 0, len(result.Comments))
	for _, comment := range result.Comments {
		items = append(items, discussionCommentModel(comment))
	}
	return &model.TaskCommentPage{Items: items, Page: int(result.Page), PageSize: int(result.PageSize), TotalPages: int(result.TotalPages), HasMore: result.Page < result.TotalPages}, nil
}

func commentWrite(body string) (vikunja.TaskCommentWrite, error) {
	if strings.TrimSpace(body) == "" || len(body) > 100_000 {
		return vikunja.TaskCommentWrite{}, clientError("VALIDATION_FAILED", "Write a comment of at most 100,000 bytes.")
	}
	return vikunja.TaskCommentWrite{Comment: body}, nil
}

func (resolver *Resolver) discussionError(err error, fallback string) error {
	if errors.Is(err, vikunja.ErrCommentUpdateUnconfirmed) {
		resolver.logError("comment update confirmation failed", err)
		return clientError("UPDATE_UNCONFIRMED", fallback)
	}
	if upstream, ok := errors.AsType[*vikunja.Error](err); ok {
		switch upstream.Status {
		case http.StatusUnauthorized, http.StatusForbidden:
			return clientError("FORBIDDEN", "The Vikunja token does not permit this comment action, or you are not its author.")
		case http.StatusNotFound:
			return clientError("NOT_FOUND", "The task or comment no longer exists or is not accessible.")
		case http.StatusBadRequest, http.StatusUnprocessableEntity:
			return clientError("VALIDATION_FAILED", "Vikunja did not accept the comment.")
		}
	}
	resolver.logError("task discussion request failed", err)
	if errors.Is(err, vikunja.ErrRejectedResponse) || errors.Is(err, service.ErrInvalidComment) {
		return clientError("UPSTREAM_REJECTED", fallback)
	}
	return upstreamClientError(err, fallback)
}

func savedCommentModel(comment vikunja.TaskComment) *model.TaskComment {
	return discussionCommentModel(service.DiscussionComment{
		ID: comment.ID, BodyHTML: comment.Comment, CreatedAt: comment.Created, UpdatedAt: comment.Updated,
		Author: service.DiscussionAuthor{ID: comment.Author.ID, Username: comment.Author.Username, Name: comment.Author.Name},
	})
}
