package vikunja

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"
)

// ErrCommentUpdateUnconfirmed prevents retrying a write whose readback failed.
var ErrCommentUpdateUnconfirmed = errors.New("comment update succeeded but its confirmation failed")

// TaskComments reads a validated page of comments belonging to the specified task.
func (client *Client) TaskComments(ctx context.Context, taskID int64, input CommentQuery) (CommentPage, error) {
	if taskID <= 0 || input.Page < 1 || input.PerPage < 1 || input.PerPage > maxUpstreamPageSize {
		return CommentPage{}, errors.New("task ID or comment pagination is invalid")
	}
	if input.Order != "asc" && input.Order != "desc" {
		return CommentPage{}, errors.New("comment order must be asc or desc")
	}
	var response CommentPage
	path := "tasks/" + strconv.FormatInt(taskID, 10) + "/comments"
	query := url.Values{
		"order_by":       {input.Order},
		pageQueryKey:     {strconv.FormatInt(input.Page, 10)},
		pageSizeQueryKey: {strconv.FormatInt(input.PerPage, 10)},
	}
	if _, err := client.doJSONWithQuery(ctx, http.MethodGet, path, query, nil, "", &response); err != nil {
		return CommentPage{}, err
	}
	if err := validateCommentPage(response, input); err != nil {
		return CommentPage{}, err
	}
	for index := range response.Items {
		if err := validateTaskComment(response.Items[index], taskID, 0); err != nil {
			return CommentPage{}, err
		}
		response.Items[index].TaskID = taskID
	}
	return response, nil
}

func validateCommentPage(page CommentPage, input CommentQuery) error {
	// Vikunja caps per_page at the instance limit. Respect the returned size.
	if page.Page != input.Page || page.PerPage < 1 || page.PerPage > input.PerPage || page.Total < 0 {
		return ErrRejectedResponse
	}
	expectedPages := int64(0)
	if page.Total > 0 {
		expectedPages = 1 + (page.Total-1)/page.PerPage
	}
	if page.TotalPages != expectedPages {
		return ErrRejectedResponse
	}
	// A deletion can remove the requested page. Return its current bounds so the
	// caller can navigate back, but never accept records beyond those bounds.
	if page.Page > page.TotalPages {
		if len(page.Items) != 0 {
			return ErrRejectedResponse
		}
		return nil
	}
	return validatePageItemCount(len(page.Items), page.Page, page.PerPage, page.Total, page.TotalPages)
}

// CreateTaskComment posts HTML once and validates the resulting comment identity.
func (client *Client) CreateTaskComment(
	ctx context.Context, taskID int64, input TaskCommentWrite,
) (TaskComment, error) {
	if taskID <= 0 {
		return TaskComment{}, errors.New("task ID must be positive")
	}
	if input.Comment == "" {
		return TaskComment{}, errors.New("comment is required")
	}

	var comment TaskComment
	path := "tasks/" + strconv.FormatInt(taskID, 10) + "/comments"
	if _, err := client.doJSON(ctx, http.MethodPost, path, input, "", &comment); err != nil {
		return TaskComment{}, err
	}
	if err := validateTaskComment(comment, taskID, 0); err != nil {
		return TaskComment{}, ErrRejectedResponse
	}
	comment.TaskID = taskID
	return comment, nil
}

// UpdateTaskComment writes once, then reads canonical author and timestamp metadata.
func (client *Client) UpdateTaskComment(
	ctx context.Context, taskID int64, commentID int64, input TaskCommentWrite,
) (TaskComment, error) {
	if taskID <= 0 || commentID <= 0 {
		return TaskComment{}, errors.New("task and comment IDs must be positive")
	}
	if input.Comment == "" {
		return TaskComment{}, errors.New("comment is required")
	}

	path := "tasks/" + strconv.FormatInt(taskID, 10) + "/comments/" + strconv.FormatInt(commentID, 10)
	if _, err := client.doJSON(ctx, http.MethodPut, path, input, "", nil); err != nil {
		return TaskComment{}, err
	}
	// Update responses omit author and creation time. Read the canonical record;
	// never retry the write if this confirmation fails.
	comment, err := client.TaskComment(ctx, taskID, commentID)
	if err != nil {
		return TaskComment{}, errors.Join(ErrCommentUpdateUnconfirmed, err)
	}
	return comment, nil
}

// TaskComment rejects mismatched task or comment identities in the upstream response.
func (client *Client) TaskComment(ctx context.Context, taskID int64, commentID int64) (TaskComment, error) {
	if taskID <= 0 || commentID <= 0 {
		return TaskComment{}, errors.New("task and comment IDs must be positive")
	}
	var comment TaskComment
	path := "tasks/" + strconv.FormatInt(taskID, 10) + "/comments/" + strconv.FormatInt(commentID, 10)
	if _, err := client.doJSON(ctx, http.MethodGet, path, nil, "", &comment); err != nil {
		return TaskComment{}, err
	}
	if err := validateTaskComment(comment, taskID, commentID); err != nil {
		return TaskComment{}, ErrRejectedResponse
	}
	comment.TaskID = taskID
	return comment, nil
}

func validateTaskComment(comment TaskComment, taskID int64, expectedID int64) error {
	if comment.ID <= 0 || (expectedID > 0 && comment.ID != expectedID) {
		return ErrRejectedResponse
	}
	if comment.TaskID != 0 && comment.TaskID != taskID {
		return ErrRejectedResponse
	}
	if comment.Author == nil || comment.Author.ID <= 0 {
		return ErrRejectedResponse
	}
	return nil
}

// DeleteTaskComment removes the identified comment using upstream authorization.
func (client *Client) DeleteTaskComment(ctx context.Context, taskID int64, commentID int64) error {
	if taskID <= 0 || commentID <= 0 {
		return errors.New("task and comment IDs must be positive")
	}

	path := "tasks/" + strconv.FormatInt(taskID, 10) + "/comments/" + strconv.FormatInt(commentID, 10)
	_, err := client.doJSON(ctx, http.MethodDelete, path, nil, "", nil)
	return err
}
