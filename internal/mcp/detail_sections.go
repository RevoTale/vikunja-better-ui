package mcp

import (
	"context"
	"slices"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type relationSummary struct {
	Kind   vikunja.RelationKind `json:"kind"`
	TaskID int64                `json:"taskId"`
	Title  string               `json:"title"`
	Done   bool                 `json:"done"`
}

func expandDetail(ctx context.Context, c *caller, input taskInput, output *taskDetail) error {
	if input.AttachmentPage < 0 {
		return errorsForTool("attachmentPage must be positive or omitted.")
	}
	if input.IncludeRelations {
		relations, err := c.client.TaskRelations(ctx, input.TaskID)
		if err != nil {
			return errorsForTool("Task relations could not be read; check permissions.")
		}
		kinds := make([]vikunja.RelationKind, 0, len(relations))
		for kind := range relations {
			kinds = append(kinds, kind)
		}
		slices.Sort(kinds)
		for _, kind := range kinds {
			for _, task := range relations[kind] {
				if len(output.Relations) == maxMetadataItems {
					output.RelationsTruncated = true
					break
				}
				output.Relations = append(output.Relations, relationSummary{Kind: kind, TaskID: task.ID, Title: task.Title,
					Done: task.Done})
			}
		}
	}
	if input.AttachmentPage > 0 {
		page, err := c.client.TaskAttachments(ctx, input.TaskID, input.AttachmentPage)
		if err != nil {
			return errorsForTool("Attachment metadata could not be read; check page and permissions.")
		}
		output.Attachments = &page
	}
	return nil
}
