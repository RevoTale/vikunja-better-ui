package service

import (
	"errors"
	"reflect"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestSavedReferencesOnlyLinkNewTargets(t *testing.T) {
	t.Parallel()
	client := &relationStub{}
	linker := ReferenceLinker{Policy: referencePolicy(), Tasks: client, Relations: client}
	result := linker.Saved(t.Context(), 1, `/tasks/2`, `<p>/tasks/2 /tasks/3 /tasks/3</p>`)
	if len(result.FailedIDs) != 0 || result.Limited || client.writes != 1 ||
		!containsRelation(client.graph[1][vikunja.RelationRelated], 3) {
		t.Fatalf("result=%+v graph=%+v writes=%d", result, client.graph, client.writes)
	}
	linker.Saved(t.Context(), 1, `/tasks/2`, `<strong>/tasks/2</strong>`)
	if client.writes != 1 {
		t.Fatal("unrelated edit restored a manually removed reference")
	}
}

func TestReferenceRepairRevalidatesPersistedContent(t *testing.T) {
	t.Parallel()
	client := &relationStub{writeErr: errors.New("offline")}
	linker := ReferenceLinker{Policy: referencePolicy(), Tasks: client, Relations: client}
	result := linker.Saved(t.Context(), 1, "", `/tasks/2`)
	if !reflect.DeepEqual(result.FailedIDs, []int64{2}) {
		t.Fatalf("failed targets = %+v", result)
	}
	if _, err := linker.Repair(t.Context(), 1, "removed", result.FailedIDs); !errors.Is(err, ErrRelationConflict) {
		t.Fatalf("removed reference repair = %v", err)
	}
	client.writeErr = nil
	result, err := linker.Repair(t.Context(), 1, `/tasks/2`, []int64{2, 2})
	if err != nil || len(result.FailedIDs) != 0 || client.writes != 2 {
		t.Fatalf("repair = %+v, %v; writes=%d", result, err, client.writes)
	}
	linker.Saved(t.Context(), 1, "", `/tasks/2`)
	if client.writes != 2 {
		t.Fatal("already linked target was written twice")
	}
}
