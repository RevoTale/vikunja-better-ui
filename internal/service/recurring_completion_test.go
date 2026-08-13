package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestCompleteRecurringRenewsSameTaskAndCreatesSnapshot(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	beforeDue := time.Date(2026, time.August, 12, 9, 0, 0, 0, time.UTC)
	afterDue := time.Date(2026, time.August, 13, 12, 0, 0, 0, time.UTC)
	before := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Water", Description: "Plants", Priority: 3,
		DueDate: beforeDue, RepeatAfter: 24 * 60 * 60, RepeatMode: 2,
		Labels: []vikunja.Label{{ID: 4, Title: "garden"}},
	}
	renewed := before
	renewed.DueDate = afterDue
	renewed.DoneAt = completedAt
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return completedAt })
	key := capabilities.CompletionKey(9, completedAt)
	created := vikunja.Task{
		ID: 12, ProjectID: 7, Title: "Water", Description: appendCompletionMetadata("Plants", key),
		Labels: []vikunja.Label{{ID: 4, Title: "garden"}, {ID: 6, Title: recurrenceHistoryLabel}},
	}
	confirmed := created
	confirmed.Done = true
	confirmed.DoneAt = completedAt
	client := &recurringClientStub{
		completionClientStub: completionClientStub{reads: []taskRead{
			{task: before, etag: `"v1"`}, {task: renewed, etag: `"v2"`}, {task: renewed, etag: `"v2"`},
			{task: created, etag: `"snapshot-v1"`}, {task: confirmed, etag: `"snapshot-v2"`},
		}},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{}, Total: 0, Page: 1, PerPage: 1000, TotalPages: 0},
		created:    vikunja.Task{ID: 12, ProjectID: 7, Title: "Water"},
		labels:     []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}},
	}
	result, err := CompleteRecurring(context.Background(), client, capabilities, 9, time.UTC)
	if err != nil {
		t.Fatalf("CompleteRecurring() error = %v", err)
	}
	if result.LiveTask.ID != 9 || result.LiveTask.Done || result.LiveTask.DueDate != afterDue {
		t.Fatalf("live task = %#v", result.LiveTask)
	}
	if result.Snapshot.ID != 12 || !result.Snapshot.Done || result.CompletionKey == "" {
		t.Fatalf("snapshot result = %#v", result)
	}
	if client.patchCalls != 2 || client.patchCheck.Done == nil || *client.patchCheck.Done || client.patchDone == nil || !*client.patchDone {
		t.Fatalf("patches = %d, last check = %#v, done = %v", client.patchCalls, client.patchCheck, client.patchDone)
	}
	if client.createInput.RepeatAfter != 0 || client.createInput.RepeatMode != 0 || client.createInput.Done {
		t.Fatalf("snapshot input = %#v", client.createInput)
	}
	if !strings.Contains(client.createInput.Description, result.CompletionKey) {
		t.Fatalf("snapshot description = %q", client.createInput.Description)
	}
	if client.attachedLabels[4] != true || client.attachedLabels[6] != true {
		t.Fatalf("attached labels = %#v", client.attachedLabels)
	}
}

func TestCompleteRecurringReconcilesExistingSnapshotWithoutCreating(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	before := vikunja.Task{ID: 9, ProjectID: 7, Title: "Water", DueDate: completedAt.Add(-time.Hour), RepeatAfter: 86400}
	renewed := before
	renewed.DueDate = completedAt.Add(23 * time.Hour)
	renewed.DoneAt = completedAt
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return completedAt })
	key := capabilities.CompletionKey(9, completedAt)
	snapshot := vikunja.Task{
		ID: 12, ProjectID: 7, Title: "Water", Done: true, DoneAt: completedAt,
		Description: completionMetadata(key), Labels: []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}},
	}
	client := &recurringClientStub{
		completionClientStub: completionClientStub{reads: []taskRead{
			{task: before, etag: `"v1"`}, {task: renewed, etag: `"v2"`}, {task: renewed, etag: `"v2"`},
		}},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{snapshot}, Total: 1, Page: 1, PerPage: 1000, TotalPages: 1},
	}
	result, err := CompleteRecurring(context.Background(), client, capabilities, 9, time.UTC)
	if err != nil || result.Snapshot.ID != 12 || client.createCalls != 0 {
		t.Fatalf("CompleteRecurring() = %#v, %v, creates=%d", result, err, client.createCalls)
	}
}

func TestVerifyScheduledRenewalCompletedBeforeDue(t *testing.T) {
	t.Parallel()

	dueAt := time.Date(2026, time.August, 12, 23, 59, 59, 0, time.UTC)
	before := vikunja.Task{ID: 9, DueDate: dueAt, RepeatAfter: 86400, RepeatMode: 0}
	renewed := before
	renewed.DueDate = dueAt.Add(24 * time.Hour)
	renewed.DoneAt = dueAt.Add(-12 * time.Hour)
	if err := verifyRenewal(before, renewed); err != nil {
		t.Fatalf("verifyRenewal() error = %v", err)
	}
}

func TestRepairRecurringSnapshotFinishesExistingPartialSnapshot(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	live := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Water", DoneAt: completedAt,
		DueDate: completedAt.Add(24 * time.Hour), RepeatAfter: 86400,
		Labels: []vikunja.Label{{ID: 4, Title: "garden"}},
	}
	key := "repair-key"
	partial := vikunja.Task{
		ID: 12, ProjectID: 7, Title: "Water", Done: true, DoneAt: completedAt,
		Description: completionMetadata(key),
	}
	confirmed := partial
	confirmed.Labels = []vikunja.Label{{ID: 4, Title: "garden"}, {ID: 6, Title: recurrenceHistoryLabel}}
	client := &recurringClientStub{
		completionClientStub: completionClientStub{reads: []taskRead{
			{task: live, etag: `"v2"`}, {task: confirmed, etag: `"snapshot-v2"`},
		}},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{partial}, Total: 1, Page: 1, PerPage: 1000, TotalPages: 1},
		labels:     []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}},
	}
	result, err := RepairRecurringSnapshot(context.Background(), client, RecurringRepairGrant{
		TaskID: 9, ProjectID: 7, LiveETag: `"v2"`, CompletionKey: key,
	})
	if err != nil {
		t.Fatalf("RepairRecurringSnapshot() error = %v", err)
	}
	if result.Snapshot.ID != 12 || !validSnapshot(result.Snapshot) || client.createCalls != 0 {
		t.Fatalf("RepairRecurringSnapshot() = %#v, creates=%d", result, client.createCalls)
	}
	if !client.attachedLabels[4] || !client.attachedLabels[6] {
		t.Fatalf("attached labels = %#v", client.attachedLabels)
	}
}

type recurringClientStub struct {
	completionClientStub
	searchPage     vikunja.TaskPage
	created        vikunja.Task
	createCalls    int
	createInput    vikunja.TaskWrite
	labels         []vikunja.Label
	attachedLabels map[int64]bool
}

func (client *recurringClientStub) TasksPage(_ context.Context, _ vikunja.TaskQuery) (vikunja.TaskPage, error) {
	return client.searchPage, nil
}

func (client *recurringClientStub) CreateTaskHTML(_ context.Context, _ int64, input vikunja.TaskWrite) (vikunja.Task, error) {
	client.createCalls++
	client.createInput = input
	return client.created, nil
}

func (client *recurringClientStub) Labels(context.Context) ([]vikunja.Label, error) {
	return client.labels, nil
}

func (client *recurringClientStub) CreateLabel(_ context.Context, input vikunja.LabelWrite) (vikunja.Label, error) {
	label := vikunja.Label{ID: 6, Title: input.Title}
	client.labels = append(client.labels, label)
	return label, nil
}

func (client *recurringClientStub) AttachLabel(_ context.Context, _ int64, labelID int64) error {
	if client.attachedLabels == nil {
		client.attachedLabels = make(map[int64]bool)
	}
	client.attachedLabels[labelID] = true
	return nil
}
