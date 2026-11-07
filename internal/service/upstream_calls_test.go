package service

import (
	"context"
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestCreationGroupsExistingMarkerReads(t *testing.T) {
	t.Parallel()
	client := &countedCreationClient{
		labels: []vikunja.Label{
			{ID: 1, Title: jobLabel}, {ID: 2, Title: fixedDueTimeLabel}, {ID: 3, Title: recurringAvailabilityLabel},
		},
		created: vikunja.Task{ID: 11, ProjectID: 7}}
	result, err := CreateTaskWithMarkers(t.Context(), client, 7, vikunja.TaskWrite{Title: "Task"},
		[]string{jobLabel, fixedDueTimeLabel, recurringAvailabilityLabel})
	if err != nil || result.RepairRequired || len(result.Task.Labels) != 3 {
		t.Fatalf("creation = %#v, %v", result, err)
	}
	if client.labelReads != 1 {
		t.Fatalf("label reads = %d, want 1", client.labelReads)
	}
}

type countedCreationClient struct {
	createClientStub

	labelReads int
	failRead   int
}

func (client *countedCreationClient) Labels(ctx context.Context) ([]vikunja.Label, error) {
	client.labelReads++
	if client.labelReads == client.failRead {
		return nil, vikunja.ErrRejectedResponse
	}
	return client.createClientStub.Labels(ctx)
}

func TestHierarchyReusesParentRelationsBeforeWrite(t *testing.T) {
	t.Parallel()
	client := &countedRelationClient{reads: make(map[int64]int)}
	if err := SetTaskRelation(t.Context(), client, client, 1, 2, vikunja.RelationChild, false); err != nil {
		t.Fatal(err)
	}
	if client.reads[1] != 1 || client.reads[2] != 1 || client.writes != 1 {
		t.Fatalf("relation reads = %v, writes = %d; want one read per task and one write", client.reads, client.writes)
	}
}

type countedRelationClient struct {
	relationStub

	reads map[int64]int
}

func (client *countedRelationClient) TaskRelations(
	ctx context.Context, id int64,
) (map[vikunja.RelationKind][]vikunja.RelatedTask, error) {
	client.reads[id]++
	return client.relationStub.TaskRelations(ctx, id)
}

func TestMarkerRefreshFailurePreventsTaskCreation(t *testing.T) {
	t.Parallel()
	client := &countedCreationClient{failRead: 2}
	_, err := CreateTaskWithMarkers(t.Context(), client, 7, vikunja.TaskWrite{Title: "Task"},
		[]string{jobLabel, fixedDueTimeLabel})
	if !errors.Is(err, vikunja.ErrRejectedResponse) || client.createTaskCalls != 0 || client.labelReads != 2 {
		t.Fatalf("error=%v, task writes=%d, catalogue reads=%d", err, client.createTaskCalls, client.labelReads)
	}
}

func TestMarkerLookupRefreshesAfterCreationAndDoesNotCacheAcrossPhases(t *testing.T) {
	t.Parallel()
	client := &markerClientStub{labelPages: [][]vikunja.Label{
		{{ID: 8, Title: jobLabel}},
		{{ID: 8, Title: jobLabel}, {ID: 2, Title: fixedDueTimeLabel}, {ID: 9, Title: fixedDueTimeLabel}},
		{{ID: 1, Title: jobLabel}},
	}}
	lookup := markerLookup{client: client}
	first, err := lookup.resolve(t.Context(), jobLabel)
	if err != nil || first.ID != 8 {
		t.Fatalf("first marker = %#v, %v", first, err)
	}
	created, err := lookup.resolve(t.Context(), fixedDueTimeLabel)
	if err != nil || created.ID != 2 || client.createCalls != 1 || client.listCalls != 2 {
		t.Fatalf("created marker = %#v, %v; creates=%d reads=%d", created, err, client.createCalls, client.listCalls)
	}
	fresh, err := ResolveMarker(t.Context(), client, jobLabel)
	if err != nil || fresh.ID != 1 || client.listCalls != 3 {
		t.Fatalf("fresh marker = %#v, %v; reads=%d", fresh, err, client.listCalls)
	}
}

func TestHierarchyReadsAncestorsAndRejectsIndirectCycle(t *testing.T) {
	t.Parallel()
	client := &countedRelationClient{
		graph: map[int64]map[vikunja.RelationKind][]vikunja.RelatedTask{
			1: {vikunja.RelationParent: {{ID: 3}}},
			3: {vikunja.RelationParent: {{ID: 4}}},
			4: {vikunja.RelationParent: {{ID: 2}}},
		},
		reads: make(map[int64]int),
	}
	err := SetTaskRelation(t.Context(), client, client, 1, 2, vikunja.RelationChild, false)
	if !errors.Is(err, ErrRelationConflict) || client.writes != 0 {
		t.Fatalf("indirect cycle error=%v, writes=%d", err, client.writes)
	}
	for _, id := range []int64{1, 2, 3, 4} {
		if client.reads[id] != 1 {
			t.Fatalf("task %d read %d times, want 1", id, client.reads[id])
		}
	}
}

func TestHierarchyReadsBackAfterUncertainWrite(t *testing.T) {
	t.Parallel()
	client := &countedRelationClient{
		writeErr: vikunja.ErrRejectedResponse, applyOnError: true,
		reads: make(map[int64]int),
	}
	err := SetTaskRelation(t.Context(), client, client, 1, 2, vikunja.RelationChild, false)
	if err != nil || client.writes != 1 || client.reads[1] != 2 || client.reads[2] != 1 {
		t.Fatalf("readback error=%v, writes=%d, reads=%v", err, client.writes, client.reads)
	}
}
