package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestCompleteNonRecurringIssuesBoundUndo(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	client := &completionClientStub{
		reads: []taskRead{
			{task: vikunja.Task{ID: 9, Title: "Deploy", Labels: []vikunja.Label{{ID: 2, Title: jobLabel}}}, etag: `"v1"`},
			{task: vikunja.Task{ID: 9, Title: "Deploy", Done: true, DoneAt: now, Labels: []vikunja.Label{{ID: 2, Title: jobLabel}}}, etag: `"v2"`},
		},
	}
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	result, err := CompleteNonRecurring(context.Background(), client, capabilities, "session-1", 9, TaskKindJob)
	if err != nil {
		t.Fatalf("CompleteNonRecurring() error = %v", err)
	}
	if !result.Task.Done || result.UndoCapability == "" || !result.UndoUntil.Equal(now.Add(30*time.Second)) {
		t.Fatalf("CompleteNonRecurring() = %#v", result)
	}
	if client.patchCalls != 1 || client.patchCheck.Done == nil || *client.patchCheck.Done || client.patchDone == nil || !*client.patchDone {
		t.Fatalf("patch calls=%d check=%#v done=%v", client.patchCalls, client.patchCheck, client.patchDone)
	}
	grant, err := capabilities.ParseUndo("session-1", result.UndoCapability)
	if err != nil || grant.ETag != `"v2"` || grant.TaskID != 9 {
		t.Fatalf("ParseUndo() = %#v, %v", grant, err)
	}
}

func TestCompleteNonRecurringRejectsKindMismatchBeforeWrite(t *testing.T) {
	t.Parallel()

	client := &completionClientStub{reads: []taskRead{{task: vikunja.Task{ID: 9, Title: "Read"}, etag: `"v1"`}}}
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), time.Now)
	_, err := CompleteNonRecurring(context.Background(), client, capabilities, "session-1", 9, TaskKindJob)
	if !errors.Is(err, ErrTaskKindMismatch) || client.patchCalls != 0 {
		t.Fatalf("CompleteNonRecurring() error = %v, patches = %d", err, client.patchCalls)
	}
}

func TestUndoNonRecurringVerifiesCapabilityState(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	token, _, err := capabilities.IssueUndo("session-1", UndoGrant{
		TaskID: 9, Kind: TaskKindOneTime, DoneAt: now, ETag: `"v2"`,
	})
	if err != nil {
		t.Fatal(err)
	}
	client := &completionClientStub{reads: []taskRead{
		{task: vikunja.Task{ID: 9, Done: true, DoneAt: now}, etag: `"v2"`},
		{task: vikunja.Task{ID: 9, Done: false}, etag: `"v3"`},
	}}
	task, err := UndoNonRecurring(context.Background(), client, capabilities, "session-1", token)
	if err != nil || task.Done {
		t.Fatalf("UndoNonRecurring() = %#v, %v", task, err)
	}
	if client.patchDone == nil || *client.patchDone {
		t.Fatalf("undo patch done = %v", client.patchDone)
	}
}

func TestUndoNonRecurringRejectsChangedETag(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	token, _, err := capabilities.IssueUndo("session-1", UndoGrant{
		TaskID: 9, Kind: TaskKindOneTime, DoneAt: now, ETag: `"v2"`,
	})
	if err != nil {
		t.Fatal(err)
	}
	client := &completionClientStub{reads: []taskRead{{
		task: vikunja.Task{ID: 9, Done: true, DoneAt: now}, etag: `"v3"`,
	}}}
	_, err = UndoNonRecurring(context.Background(), client, capabilities, "session-1", token)
	if !errors.Is(err, ErrTaskStateChanged) || client.patchCalls != 0 {
		t.Fatalf("UndoNonRecurring() error = %v, patches = %d", err, client.patchCalls)
	}
}

type taskRead struct {
	task vikunja.Task
	etag string
}

type completionClientStub struct {
	reads      []taskRead
	readCalls  int
	patchCalls int
	patchDone  *bool
	patchCheck vikunja.TaskCheck
}

func (client *completionClientStub) Task(_ context.Context, _ int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	read := client.reads[client.readCalls]
	client.readCalls++
	return read.task, vikunja.ResponseMetadata{ETag: read.etag}, nil
}

func (client *completionClientStub) PatchTaskChecked(_ context.Context, _ int64, patch vikunja.TaskPatch, check vikunja.TaskCheck) (vikunja.Task, error) {
	client.patchCalls++
	client.patchDone = patch.Done
	client.patchCheck = check
	return vikunja.Task{}, nil
}
