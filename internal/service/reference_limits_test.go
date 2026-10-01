package service

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestReferencesBoundTargetsAndRefuseIncompletePreviousSets(t *testing.T) {
	t.Parallel()
	var content strings.Builder
	for id := 2; id <= 23; id++ {
		content.WriteString(" /tasks/" + strconv.Itoa(id))
	}
	result := referencePolicy().Extract(content.String(), 1)
	if !result.Limited || len(result.IDs) != 20 {
		t.Fatalf("bounded references = %+v", result)
	}
	client := &relationStub{}
	linker := ReferenceLinker{Policy: referencePolicy(), Tasks: client, Relations: client}
	links := linker.Saved(t.Context(), 1, content.String(), content.String()+" edited")
	if !links.Limited || client.writes != 0 {
		t.Fatalf("incomplete delta = %+v, writes=%d", links, client.writes)
	}
}

func TestReferenceCancellationReportsAllUnattemptedTargets(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	client := &relationStub{}
	linker := ReferenceLinker{Policy: referencePolicy(), Tasks: client, Relations: client}
	result := linker.Saved(ctx, 1, "", `/tasks/2 /tasks/3`)
	if len(result.FailedIDs) != 2 || client.writes != 0 {
		t.Fatalf("cancelled links = %+v; writes=%d", result, client.writes)
	}
}

func TestCreationMarkerFailurePreservesConfirmedDescription(t *testing.T) {
	t.Parallel()
	client := &unreadableCreatedTask{
		labels:           []vikunja.Label{{ID: 3, Title: jobLabel}},
		created:          vikunja.Task{ID: 1, ProjectID: 7, Title: "Created", Description: `<p>/tasks/2</p>`},
		attachErrByLabel: map[int64]error{3: errors.New("denied")}}
	result, err := CreateTaskWithMarker(t.Context(), client, 7, vikunja.TaskWrite{Title: "Created"}, jobLabel)
	if err != nil || !result.RepairRequired || result.Task.Description != client.created.Description {
		t.Fatalf("creation = %+v, error=%v", result, err)
	}
}

type unreadableCreatedTask struct{ createClientStub }

func (*unreadableCreatedTask) Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	return vikunja.Task{}, vikunja.ResponseMetadata{}, errors.New("unavailable")
}
