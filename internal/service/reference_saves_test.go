package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestReferenceCommentSaveKeepsPartialSuccessAndSkipsUnconfirmedWrites(t *testing.T) {
	t.Parallel()
	relations := &relationStub{writeErr: errors.New("denied")}
	linker := ReferenceLinker{Policy: referencePolicy(), Tasks: relations, Relations: relations}
	comments := &referenceComments{}
	saved, links, err := SaveCommentWithReferences(t.Context(), comments, linker, 1, 0,
		vikunja.TaskCommentWrite{Comment: `/tasks/2`})
	if err != nil || saved.ID != 7 || comments.writes != 1 || len(links.FailedIDs) != 1 {
		t.Fatalf("saved=%+v links=%+v error=%v", saved, links, err)
	}
	comments.failure = errors.New("unconfirmed")
	_, _, err = SaveCommentWithReferences(t.Context(), comments, linker, 1, 0,
		vikunja.TaskCommentWrite{Comment: `/tasks/3`})
	if err == nil || relations.writes != 1 {
		t.Fatal("unconfirmed comment triggered linking")
	}
}

func TestReferenceCommentEditOnlyUsesNewLinks(t *testing.T) {
	t.Parallel()
	relations := &relationStub{}
	comments := &referenceComments{before: `/tasks/2`}
	linker := ReferenceLinker{Policy: referencePolicy(), Tasks: relations, Relations: relations}
	_, _, err := SaveCommentWithReferences(t.Context(), comments, linker, 1, 7,
		vikunja.TaskCommentWrite{Comment: `/tasks/2 /tasks/3`})
	if err != nil || relations.writes != 1 || !containsRelation(relations.graph[1][vikunja.RelationRelated], 3) {
		t.Fatalf("relations=%+v error=%v", relations, err)
	}
}

func TestReferenceTaskEditLinksOnlyConfirmedNewDescription(t *testing.T) {
	t.Parallel()
	for _, unconfirmed := range []bool{false, true} {
		before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Task", Description: `/tasks/2`}
		client := &editClientStub{task: before, ignoreDescription: unconfirmed}
		relations := &relationStub{}
		linker := ReferenceLinker{Policy: referencePolicy(), Tasks: relations, Relations: relations}
		_, _, err := EditTaskWithReferences(t.Context(), client, EditTaskInput{
			TaskID: 1, ProjectID: 7, Title: "Task", Description: `/tasks/2 /tasks/3`, ExpectedVersion: TaskVersion(before),
		}, time.UTC, []int64{7}, linker)
		if unconfirmed {
			if !errors.Is(err, ErrEditPartial) || relations.writes != 0 {
				t.Fatalf("unconfirmed edit linked: error=%v writes=%d", err, relations.writes)
			}
		} else if err != nil || relations.writes != 1 {
			t.Fatalf("confirmed edit: error=%v writes=%d", err, relations.writes)
		}
	}
}

type referenceComments struct {
	before  string
	writes  int
	failure error
}

func (client *referenceComments) TaskComment(context.Context, int64, int64) (vikunja.TaskComment, error) {
	return vikunja.TaskComment{ID: 7, Comment: client.before}, client.failure
}

func (client *referenceComments) CreateTaskComment(
	_ context.Context, _ int64, write vikunja.TaskCommentWrite,
) (vikunja.TaskComment, error) {
	client.writes++
	return vikunja.TaskComment{ID: 7, Comment: write.Comment}, client.failure
}

func (client *referenceComments) UpdateTaskComment(
	ctx context.Context, taskID, _ int64, write vikunja.TaskCommentWrite,
) (vikunja.TaskComment, error) {
	return client.CreateTaskComment(ctx, taskID, write)
}
