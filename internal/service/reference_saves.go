package service

import (
	"context"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// EditTaskWithReferences uses the validated pre-save description for additive link detection.
func EditTaskWithReferences(
	ctx context.Context, client taskEditClient, input EditTaskInput,
	location *time.Location, projects []int64, linker ReferenceLinker,
) (vikunja.Task, ReferenceLinkResult, error) {
	before, _, err := client.Task(ctx, input.TaskID)
	if err != nil {
		return vikunja.Task{}, ReferenceLinkResult{}, err
	}
	saved, err := editLoadedTask(ctx, client, input, location, projects, before)
	if err != nil {
		return vikunja.Task{}, ReferenceLinkResult{}, err
	}
	return saved, linker.Saved(ctx, saved.ID, before.Description, saved.Description), nil
}

type referenceCommentClient interface {
	TaskComment(context.Context, int64, int64) (vikunja.TaskComment, error)
	CreateTaskComment(context.Context, int64, vikunja.TaskCommentWrite) (vikunja.TaskComment, error)
	UpdateTaskComment(context.Context, int64, int64, vikunja.TaskCommentWrite) (vikunja.TaskComment, error)
}

// SaveCommentWithReferences links only after the upstream confirms the single comment write.
func SaveCommentWithReferences(
	ctx context.Context, client referenceCommentClient, linker ReferenceLinker,
	taskID, commentID int64, write vikunja.TaskCommentWrite,
) (vikunja.TaskComment, ReferenceLinkResult, error) {
	var before, saved vikunja.TaskComment
	var err error
	if commentID == 0 {
		saved, err = client.CreateTaskComment(ctx, taskID, write)
	} else {
		before, err = client.TaskComment(ctx, taskID, commentID)
		if err == nil {
			saved, err = client.UpdateTaskComment(ctx, taskID, commentID, write)
		}
	}
	if err != nil {
		return vikunja.TaskComment{}, ReferenceLinkResult{}, err
	}
	return saved, linker.Saved(ctx, taskID, before.Comment, saved.Comment), nil
}
