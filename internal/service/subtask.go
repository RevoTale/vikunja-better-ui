package service

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// ErrInvalidSubtask rejects properties before any upstream write.
var ErrInvalidSubtask = errors.New("subtask properties are invalid")

// SubtaskInput overrides only the three properties eligible for one-time inheritance.
// A nil label slice inherits; an empty slice explicitly clears inherited labels.
type SubtaskInput struct {
	Title     string
	ProjectID *int64
	Priority  *int64
	LabelIDs  []int64
}

// SubtaskResult preserves the created identity even when linking fails afterward.
type SubtaskResult struct {
	Creation      CreationResult
	RelationError error
}

// CreateSubtask creates one ordinary task, then links it without retrying task creation.
func CreateSubtask(
	ctx context.Context, tasks taskCreateClient, relations relationClient, parentID int64, input SubtaskInput,
) (SubtaskResult, error) {
	parent, _, err := tasks.Task(ctx, parentID)
	if err != nil {
		return SubtaskResult{}, err
	}
	if !CanChangeTaskRelations(parent) {
		return SubtaskResult{}, ErrRelationReadOnly
	}
	project, write, labels, err := subtaskWrite(parent, input)
	if err != nil {
		return SubtaskResult{}, err
	}
	created, err := CreateLabeledTask(ctx, tasks, project, write, nil, labels)
	if err != nil {
		return SubtaskResult{}, err
	}
	linkErr := SetTaskRelation(ctx, tasks, relations, parentID, created.Task.ID, vikunja.RelationChild, false)
	return SubtaskResult{Creation: created, RelationError: linkErr}, nil
}

func subtaskWrite(parent vikunja.Task, input SubtaskInput) (int64, vikunja.TaskWrite, []int64, error) {
	project, priority := parent.ProjectID, parent.Priority
	if input.ProjectID != nil {
		project = *input.ProjectID
	}
	if input.Priority != nil {
		priority = *input.Priority
	}
	title := strings.TrimSpace(input.Title)
	if project <= 0 || priority < 0 || priority > 5 || title == "" || utf8.RuneCountInString(title) > 250 {
		return 0, vikunja.TaskWrite{}, nil, ErrInvalidSubtask
	}
	labels := input.LabelIDs
	if labels == nil {
		labels = []int64{}
		for _, label := range parent.Labels {
			if !IsInternalLabel(label.Title) {
				labels = append(labels, label.ID)
			}
		}
	}
	write, err := baseTaskWrite(input.Title, "", priority)
	return project, write, labels, err
}
