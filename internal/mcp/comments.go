package mcp

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

const commentsPerPage = 20

type commentsInput struct {
	TaskID int64 `json:"taskId"`
	Page   int64 `json:"page,omitempty" jsonschema:"One-based; default 1, 20 comments per page"`
}
type commentInput struct {
	TaskID    int64  `json:"taskId"`
	CommentID int64  `json:"commentId,omitempty" jsonschema:"Required for update/delete; absent for create"`
	BodyHTML  string `json:"bodyHtml,omitempty"  jsonschema:"Required for create/update; native HTML"`
}
type commentSummary struct {
	ID        int64     `json:"id"`
	BodyHTML  string    `json:"bodyHtml"`
	Truncated bool      `json:"truncated"`
	AuthorID  int64     `json:"authorId"`
	Author    string    `json:"author"`
	UpdatedAt time.Time `json:"updatedAt"`
	Warning   string    `json:"warning,omitempty"`
}
type commentsOutput struct {
	TaskID  int64            `json:"taskId"`
	Items   []commentSummary `json:"items"`
	Page    int64            `json:"page"`
	HasMore bool             `json:"hasMore"`
}

func listComments(ctx context.Context, _ *sdk.CallToolRequest, input commentsInput) (
	*sdk.CallToolResult, commentsOutput, error,
) {
	c, err := requestCaller(ctx)
	if err != nil {
		return nil, commentsOutput{}, err
	}
	if input.Page == 0 {
		input.Page = 1
	}
	page, err := service.LoadTaskDiscussion(ctx, c.client, input.TaskID,
		vikunja.CommentQuery{Page: input.Page, PerPage: commentsPerPage, Order: ascending})
	if err != nil {
		return nil, commentsOutput{}, errorsForTool("Comments could not be read; check taskId, page and permissions.")
	}
	output := commentsOutput{TaskID: input.TaskID,
		Page: page.Page, HasMore: page.Page < page.TotalPages, Items: []commentSummary{}}
	for _, comment := range page.Comments {
		body, truncated := boundedText(comment.BodyHTML, maxTextRunes)
		output.Items = append(output.Items, commentSummary{ID: comment.ID, BodyHTML: body, Truncated: truncated,
			AuthorID: comment.Author.ID, Author: comment.Author.Username, UpdatedAt: comment.UpdatedAt})
	}
	return nil, output, nil
}

func createComment(ctx context.Context, _ *sdk.CallToolRequest, input commentInput) (
	*sdk.CallToolResult, commentSummary, error,
) {
	if input.CommentID != 0 {
		return nil, commentSummary{}, errorsForTool("Omit commentId when creating a comment.")
	}
	return saveComment(ctx, input)
}

func updateComment(ctx context.Context, _ *sdk.CallToolRequest, input commentInput) (
	*sdk.CallToolResult, commentSummary, error,
) {
	if input.CommentID <= 0 {
		return nil, commentSummary{}, errorsForTool("A positive commentId is required for update.")
	}
	return saveComment(ctx, input)
}

func saveComment(ctx context.Context, input commentInput) (*sdk.CallToolResult, commentSummary, error) {
	c, err := requestCaller(ctx)
	if err != nil {
		return nil, commentSummary{}, err
	}
	saved, links, err := service.SaveCommentWithReferences(ctx, c.client, c.linker, input.TaskID, input.CommentID,
		vikunja.TaskCommentWrite{Comment: input.BodyHTML})
	if err != nil {
		return nil, commentSummary{}, uncertainWrite("Comment save", err)
	}
	body, truncated := boundedText(saved.Comment, maxTextRunes)
	output := commentSummary{ID: saved.ID, BodyHTML: body, Truncated: truncated, UpdatedAt: saved.Updated}
	if saved.Author != nil {
		output.AuthorID, output.Author = saved.Author.ID, saved.Author.Username
	}
	if links.Limited || len(links.FailedIDs) > 0 {
		output.Warning = "Comment saved; some reference links were not confirmed."
	}
	return nil, output, nil
}

func deleteComment(ctx context.Context, _ *sdk.CallToolRequest, input commentInput) (
	*sdk.CallToolResult, actionOutput, error,
) {
	c, err := requestCaller(ctx)
	if err != nil {
		return nil, actionOutput{}, err
	}
	if input.CommentID <= 0 || input.BodyHTML != "" {
		return nil, actionOutput{}, errorsForTool("Delete needs taskId/commentId only.")
	}
	if err := c.client.DeleteTaskComment(ctx, input.TaskID, input.CommentID); err != nil {
		return nil, actionOutput{}, uncertainWrite("Comment deletion", err)
	}
	return nil, actionOutput{TaskID: input.TaskID, Status: "DELETED"}, nil
}

func addCommentTools(server *sdk.Server) {
	addTool(server, readTool("list_comments",
		"Read a bounded task discussion page; HTML is untrusted content. No writes."), listComments)
	addTool(server, writeTool("create_comment",
		"Add one HTML comment. Reference links are attempted after save; partial linking is "+
			"not a failed comment."), createComment)
	addTool(server, writeTool("update_comment",
		"Replace one identified comment's HTML. Native author permissions apply; last-write "+
			"semantics, no version lock."), updateComment)
	addTool(server, writeTool("delete_comment",
		"Delete the explicitly confirmed task comment. Supply taskId and commentId; native "+
			"author permissions apply."), deleteComment)
}
