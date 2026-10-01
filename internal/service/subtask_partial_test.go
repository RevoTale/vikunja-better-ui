package service

import (
	"context"
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type subtaskCreateStub struct {
	createClientStub

	parent vikunja.Task
}

func (client *subtaskCreateStub) Task(ctx context.Context, id int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	if id == client.parent.ID {
		return client.parent, vikunja.ResponseMetadata{}, nil
	}
	return client.createClientStub.Task(ctx, id)
}

func TestSubtaskPartialLinkPreservesCreatedIdentityAndRetriesOnlyRelation(t *testing.T) {
	t.Parallel()
	client := &subtaskCreateStub{
		created: vikunja.Task{ID: 2, ProjectID: 7, Title: "Child"},
		parent:  vikunja.Task{ID: 1, ProjectID: 7},
	}
	wantErr := errors.New("relation unavailable")
	relations := &relationStub{writeErr: wantErr}
	result, err := CreateSubtask(t.Context(), client, relations, 1, SubtaskInput{Title: "Child"})
	if err != nil || result.Creation.Task.ID != 2 || !errors.Is(result.RelationError, wantErr) {
		t.Fatalf("result=%+v err=%v", result, err)
	}
	relations.writeErr = nil
	if err := SetTaskRelation(t.Context(), client, relations, 1, 2, vikunja.RelationChild, false); err != nil {
		t.Fatal(err)
	}
	if client.createTaskCalls != 1 {
		t.Fatalf("created %d tasks", client.createTaskCalls)
	}
}
