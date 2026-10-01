package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestSkipRecurringRejectsUnboundOccurrenceWithoutWrites(t *testing.T) {
	t.Parallel()

	dueAt := time.Date(2026, time.October, 1, 20, 0, 0, 0, time.UTC)
	for _, testCase := range []struct {
		name     string
		expected time.Time
	}{
		{name: "missing"},
		{name: "previous occurrence", expected: dueAt.Add(-24 * time.Hour)},
		{name: "future occurrence", expected: dueAt.Add(24 * time.Hour)},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			client := &recurringClientStub{reads: []taskRead{{task: vikunja.Task{
				ID: 9, ProjectID: 7, Title: "Read", DueDate: dueAt, RepeatAfter: 86400, RepeatMode: 2,
			}, etag: `"v1"`}}}
			capabilities := NewCapabilityManager(
				[]byte("01234567890123456789012345678901"), func() time.Time { return dueAt },
			)
			_, err := SkipRecurring(context.Background(), client, capabilities, 9, testCase.expected, time.UTC)
			if !errors.Is(err, ErrTaskStateChanged) {
				t.Fatalf("SkipRecurring() error = %v, want occurrence conflict", err)
			}
			if client.patchCalls != 0 || client.createCalls != 0 || len(client.labels) != 0 ||
				len(client.attachedLabels) != 0 {
				t.Fatalf("rejected occurrence performed writes: %#v", client)
			}
		})
	}
}

func TestSkipRecurringReplayAfterArchiveFailureDoesNotRenewAgain(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.October, 1, 20, 0, 0, 0, time.UTC)
	before := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Read", DueDate: completedAt.Add(-time.Hour),
		RepeatAfter: 86400, RepeatMode: 2,
	}
	renewed := before
	renewed.DueDate = completedAt.Add(24 * time.Hour)
	renewed.DoneAt = completedAt
	client := &archiveFailureClient{
		reads: []taskRead{
			{task: before, etag: `"v1"`}, {task: renewed, etag: `"v2"`},
			{task: renewed, etag: `"v2"`}, {task: renewed, etag: `"v2"`},
		},
		searchPage: vikunja.TaskPage{Page: 1, PerPage: 1000}}
	capabilities := NewCapabilityManager(
		[]byte("01234567890123456789012345678901"), func() time.Time { return completedAt },
	)
	result, err := SkipRecurring(context.Background(), client, capabilities, 9, before.DueDate, time.UTC)
	if err != nil || !result.RepairRequired || result.Snapshot.ID != 0 {
		t.Fatalf("failed archive must remain explicit: result=%#v, error=%v", result, err)
	}
	_, err = SkipRecurring(context.Background(), client, capabilities, 9, before.DueDate, time.UTC)
	if !errors.Is(err, ErrTaskStateChanged) || client.patchCalls != 1 || client.createCalls != 1 {
		t.Fatalf("replay: error=%v, renewals=%d, archive attempts=%d", err, client.patchCalls, client.createCalls)
	}
}

type archiveFailureClient struct {
	recurringClientStub
}

func (client *archiveFailureClient) CreateTaskHTML(
	_ context.Context, _ int64, _ vikunja.TaskWrite,
) (vikunja.Task, error) {
	client.createCalls++
	return vikunja.Task{}, errors.New("archive unavailable")
}
