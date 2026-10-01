package service

import (
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestRelationReconcilesUncertainWriteAndReplay(t *testing.T) {
	t.Parallel()
	client := &relationStub{writeErr: errors.New("connection interrupted"), applyOnError: true}
	for range 2 {
		if err := SetTaskRelation(t.Context(), client, client, 1, 2, vikunja.RelationRelated, false); err != nil {
			t.Fatal(err)
		}
	}
	if client.writes != 1 {
		t.Fatalf("writes = %d, want 1", client.writes)
	}
}

func TestRelationFailureNeverRetriesWrite(t *testing.T) {
	t.Parallel()
	wantErr := errors.New("write denied")
	client := &relationStub{writeErr: wantErr}
	err := SetTaskRelation(t.Context(), client, client, 1, 2, vikunja.RelationRelated, false)
	if !errors.Is(err, wantErr) || client.writes != 1 {
		t.Fatalf("error=%v writes=%d", err, client.writes)
	}
}

func TestRelationReadFailurePreventsMutation(t *testing.T) {
	t.Parallel()
	wantErr := errors.New("access denied")
	client := &relationStub{readErr: wantErr}
	err := SetTaskRelation(t.Context(), client, client, 1, 2, vikunja.RelationRelated, false)
	if !errors.Is(err, wantErr) || client.writes != 0 {
		t.Fatalf("error=%v writes=%d", err, client.writes)
	}
}
