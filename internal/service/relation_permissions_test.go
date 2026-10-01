package service

import (
	"context"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type relationPermissionReader struct{}

func (relationPermissionReader) Task(_ context.Context, id int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	permission := 0
	if id == 1 {
		permission = 2
	}
	return vikunja.Task{ID: id, MaxPermission: &permission}, vikunja.ResponseMetadata{}, nil
}

func TestDetachReadOnlyParentUsesWritableChildAsBase(t *testing.T) {
	t.Parallel()
	client := &relationStub{graph: map[int64]map[vikunja.RelationKind][]vikunja.RelatedTask{
		1: {vikunja.RelationParent: {{ID: 2}}},
	}}
	err := SetTaskRelation(t.Context(), relationPermissionReader{}, client, 1, 2, vikunja.RelationParent, true)
	if err != nil || client.deletedBase != 1 || client.deletedKind != vikunja.RelationParent {
		t.Fatalf("error=%v deleted base=%d kind=%s", err, client.deletedBase, client.deletedKind)
	}
}

func TestParentDirectionCannotBypassHierarchyValidationOnCreate(t *testing.T) {
	t.Parallel()
	client := &relationStub{}
	if err := SetTaskRelation(t.Context(), client, client, 1, 2, vikunja.RelationParent, false); err == nil {
		t.Fatal("parent direction accepted for creation")
	}
	if client.writes != 0 {
		t.Fatal("wrote an invalid hierarchy")
	}
}
