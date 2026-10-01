package service

import (
	"context"
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestRelationsRejectSecondParentAndCycleBeforeWriting(t *testing.T) {
	t.Parallel()
	for _, testCase := range []struct {
		name  string
		graph map[int64]map[vikunja.RelationKind][]vikunja.RelatedTask
	}{
		{name: "second parent", graph: map[int64]map[vikunja.RelationKind][]vikunja.RelatedTask{
			2: {vikunja.RelationParent: {{ID: 3}}},
		}},
		{name: "cycle", graph: map[int64]map[vikunja.RelationKind][]vikunja.RelatedTask{
			1: {vikunja.RelationParent: {{ID: 2}}},
		}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			client := &relationStub{graph: testCase.graph}
			err := SetTaskRelation(t.Context(), client, client, 1, 2, vikunja.RelationChild, false)
			if !errors.Is(err, ErrRelationConflict) || client.writes != 0 {
				t.Fatalf("relation: error=%v, writes=%d", err, client.writes)
			}
		})
	}
}

type relationStub struct {
	graph        map[int64]map[vikunja.RelationKind][]vikunja.RelatedTask
	writes       int
	writeErr     error
	applyOnError bool
	readErr      error
	deletedBase  int64
	deletedKind  vikunja.RelationKind
}

func (*relationStub) Task(_ context.Context, id int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	return vikunja.Task{ID: id, Title: "Task"}, vikunja.ResponseMetadata{}, nil
}

func (client *relationStub) TaskRelations(
	_ context.Context, id int64,
) (map[vikunja.RelationKind][]vikunja.RelatedTask, error) {
	return client.graph[id], client.readErr
}

func (client *relationStub) CreateTaskRelation(_ context.Context, base, other int64, kind vikunja.RelationKind) error {
	client.writes++
	if client.writeErr == nil || client.applyOnError {
		if client.graph == nil {
			client.graph = make(map[int64]map[vikunja.RelationKind][]vikunja.RelatedTask)
		}
		if client.graph[base] == nil {
			client.graph[base] = make(map[vikunja.RelationKind][]vikunja.RelatedTask)
		}
		client.graph[base][kind] = append(client.graph[base][kind], vikunja.RelatedTask{ID: other})
	}
	return client.writeErr
}

func (client *relationStub) DeleteTaskRelation(_ context.Context, base, _ int64, kind vikunja.RelationKind) error {
	client.writes++
	client.deletedBase = base
	client.deletedKind = kind
	return nil
}
