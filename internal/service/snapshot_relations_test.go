package service

import (
	"context"
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type snapshotRelationsStub struct {
	written  []vikunja.TaskRelation
	writeErr error
}

func (s *snapshotRelationsStub) TaskRelations(
	_ context.Context, id int64,
) (map[vikunja.RelationKind][]vikunja.RelatedTask, error) {
	if id == 1 {
		return map[vikunja.RelationKind][]vikunja.RelatedTask{
			vikunja.RelationRelated: {{ID: 3}, {ID: 4}}, vikunja.RelationChild: {{ID: 5}}, vikunja.RelationParent: {{ID: 6}},
		}, nil
	}
	related := []vikunja.RelatedTask{{ID: 3}}
	for _, relation := range s.written {
		related = append(related, vikunja.RelatedTask{ID: relation.OtherTaskID})
	}
	return map[vikunja.RelationKind][]vikunja.RelatedTask{vikunja.RelationRelated: related}, nil
}
func (s *snapshotRelationsStub) CreateTaskRelation(
	_ context.Context, task, other int64, kind vikunja.RelationKind,
) error {
	s.written = append(s.written, vikunja.TaskRelation{TaskID: task, OtherTaskID: other, RelationKind: kind})
	return s.writeErr
}

func TestSnapshotRelationRepairReconcilesUncertainWrite(t *testing.T) {
	t.Parallel()
	client := &snapshotRelationsStub{writeErr: errors.New("response lost after upstream applied relation")}
	if err := copySnapshotRelations(t.Context(), client, 1, 2); err == nil {
		t.Fatal("uncertain write reported success")
	}
	if err := copySnapshotRelations(t.Context(), client, 1, 2); err != nil || len(client.written) != 1 {
		t.Fatalf("repair repeated confirmed write: %v, %+v", err, client.written)
	}
}
func TestSnapshotCopiesOnlyRelatedAndRepairDoesNotDuplicate(t *testing.T) {
	t.Parallel()
	client := &snapshotRelationsStub{}
	for range 2 {
		if err := copySnapshotRelations(t.Context(), client, 1, 2); err != nil {
			t.Fatal(err)
		}
	}
	if len(client.written) != 1 || client.written[0].OtherTaskID != 4 ||
		client.written[0].RelationKind != vikunja.RelationRelated {
		t.Fatalf("unexpected copied relations: %+v", client.written)
	}
}
