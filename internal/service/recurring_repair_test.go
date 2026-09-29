package service

import (
	"context"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

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
		reads: []taskRead{
			{task: live, etag: `"v2"`}, {task: confirmed, etag: `"snapshot-v2"`},
		},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{partial}, Total: 1, Page: 1, PerPage: 1000, TotalPages: 1},
		labels:     []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}},
	}
	result, err := RepairRecurringSnapshot(context.Background(), client, RecurringRepairGrant{
		TaskID: 9, ProjectID: 7, LiveETag: `"v2"`, CompletionKey: key,
		Outcome: CompletionOutcomeCompleted,
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

func TestRepairSkippedSnapshotAttachesBothOutcomeMarkers(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	live := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Water", DoneAt: completedAt,
		DueDate: completedAt.Add(24 * time.Hour), RepeatAfter: 86400,
		Labels: []vikunja.Label{{ID: 4, Title: "garden"}},
	}
	key := "skipped-repair-key"
	partial := vikunja.Task{
		ID: 12, ProjectID: 7, Title: "Water", Done: true, DoneAt: completedAt,
		Description: completionMetadata(key),
	}
	confirmed := partial
	confirmed.Labels = []vikunja.Label{
		{ID: 4, Title: "garden"},
		{ID: 6, Title: recurrenceHistoryLabel},
		{ID: 8, Title: skippedLabel},
	}
	client := &recurringClientStub{
		reads: []taskRead{
			{task: live, etag: `"v2"`}, {task: confirmed, etag: `"snapshot-v2"`},
		},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{partial}, Total: 1, Page: 1, PerPage: 1000, TotalPages: 1},
		labels: []vikunja.Label{
			{ID: 6, Title: recurrenceHistoryLabel},
			{ID: 8, Title: skippedLabel},
		},
	}
	result, err := RepairRecurringSnapshot(context.Background(), client, RecurringRepairGrant{
		TaskID: 9, ProjectID: 7, LiveETag: `"v2"`, CompletionKey: key,
		Outcome: CompletionOutcomeSkipped,
	})
	if err != nil {
		t.Fatalf("RepairRecurringSnapshot() error = %v", err)
	}
	if result.Snapshot.ID != 12 || !snapshotMatchesOutcome(result.Snapshot, CompletionOutcomeSkipped) ||
		client.createCalls != 0 {
		t.Fatalf("RepairRecurringSnapshot() = %#v, creates=%d", result, client.createCalls)
	}
	for _, labelID := range []int64{4, 6, 8} {
		if !client.attachedLabels[labelID] {
			t.Fatalf("label %d was not attached: %#v", labelID, client.attachedLabels)
		}
	}
}

func TestRepairRecurringSnapshotFinishesFixedDueTimeNormalization(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 16, 10, 0, 0, 0, time.UTC)
	nativeDue := completedAt.Add(48 * time.Hour)
	targetDue := time.Date(2026, time.August, 18, 20, 0, 0, 0, time.UTC)
	marker := vikunja.Label{ID: 10, Title: fixedDueTimeLabel}
	live := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Read", DoneAt: completedAt, DueDate: nativeDue,
		RepeatAfter: 2 * 86400, RepeatMode: 2, Labels: []vikunja.Label{marker},
	}
	normalized := live
	normalized.DueDate = targetDue
	key := "fixed-time-repair"
	snapshot := vikunja.Task{
		ID: 12, ProjectID: 7, Title: "Read", Done: true, DoneAt: completedAt,
		Description: completionMetadata(key),
		Labels:      []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}},
	}
	client := &recurringClientStub{
		reads: []taskRead{
			{task: live, etag: `"v2"`},
			{task: normalized, etag: `"v3"`},
			{task: snapshot, etag: `"snapshot-v2"`},
		},
		searchPage: vikunja.TaskPage{
			Items: []vikunja.Task{snapshot}, Total: 1, Page: 1, PerPage: 1000, TotalPages: 1,
		},
	}

	result, err := RepairRecurringSnapshot(context.Background(), client, RecurringRepairGrant{
		TaskID: 9, ProjectID: 7, LiveETag: `"v2"`, CompletionKey: key,
		Outcome: CompletionOutcomeCompleted, RenewedDoneAt: completedAt,
		NativeDueAt: nativeDue, TargetDueAt: targetDue, RepeatAfter: 2 * 86400, RepeatMode: 2,
	})
	if err != nil {
		t.Fatalf("RepairRecurringSnapshot() error = %v", err)
	}
	if !result.LiveTask.DueDate.Equal(targetDue) || result.Snapshot.ID != snapshot.ID {
		t.Fatalf("RepairRecurringSnapshot() = %#v", result)
	}
	if len(client.patchDues) != 1 || !client.patchDues[0].Equal(targetDue) || client.patchDone != nil {
		t.Fatalf("repair patches: due=%#v done=%v", client.patchDues, client.patchDone)
	}
}

func TestRepairRecurringSnapshotFinishesWholeJobScheduleNormalization(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	native := recurringJobAt(
		time.Date(2026, time.August, 14, 12, 0, 0, 0, time.UTC),
		2*recurrenceDaySeconds,
		2,
	)
	native.ID = 9
	native.ProjectID = 7
	native.DoneAt = completedAt
	target := jobSchedule{
		StartAt: time.Date(2026, time.August, 14, 9, 0, 0, 0, time.UTC),
		EndAt:   time.Date(2026, time.August, 14, 10, 0, 0, 0, time.UTC),
		DueAt:   time.Date(2026, time.August, 14, 11, 0, 0, 0, time.UTC),
	}
	normalized := native
	normalized.StartDate = target.StartAt
	normalized.EndDate = target.EndAt
	normalized.DueDate = target.DueAt
	snapshot := vikunja.Task{
		ID: 12, ProjectID: 7, Title: "Read a book", Done: true, DoneAt: completedAt,
		Description: completionMetadata("job-schedule-repair"),
		Labels: []vikunja.Label{
			{ID: 1, Title: jobLabel},
			{ID: 6, Title: recurrenceHistoryLabel},
		},
	}
	client := &recurringClientStub{
		searchPage: vikunja.TaskPage{
			Items: []vikunja.Task{snapshot}, Total: 1, Page: 1, PerPage: 1000, TotalPages: 1,
		},
	}
	client.reads = []taskRead{
		{task: native, etag: `"v2"`},
		{task: normalized, etag: `"v3"`},
		{task: snapshot, etag: `"snapshot-v2"`},
	}

	result, err := RepairRecurringSnapshot(context.Background(), client, RecurringRepairGrant{
		TaskID: 9, ProjectID: 7, LiveETag: `"v2"`, CompletionKey: "job-schedule-repair",
		Outcome: CompletionOutcomeCompleted, RenewedDoneAt: completedAt,
		NativeStartAt: native.StartDate, NativeEndAt: native.EndDate, NativeDueAt: native.DueDate,
		TargetStartAt: target.StartAt, TargetEndAt: target.EndAt, TargetDueAt: target.DueAt,
		RepeatAfter: native.RepeatAfter, RepeatMode: native.RepeatMode,
	})
	if err != nil {
		t.Fatalf("RepairRecurringSnapshot() error = %v", err)
	}
	if !jobScheduleMatches(result.LiveTask, target) || result.Snapshot.ID != snapshot.ID ||
		len(client.patchSchedules) != 1 || client.patchSchedules[0] != target {
		t.Fatalf("RepairRecurringSnapshot() = %#v, patches = %#v", result, client.patchSchedules)
	}
}

func TestRepairNormalCompletionRejectsSkippedSnapshot(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	live := vikunja.Task{
		ID: 9, ProjectID: 7, DoneAt: completedAt,
		DueDate: completedAt.Add(24 * time.Hour), RepeatAfter: 86400,
	}
	candidate := vikunja.Task{
		ID: 12, ProjectID: 7, Done: true, DoneAt: completedAt,
		Description: completionMetadata("repair-key"),
		Labels: []vikunja.Label{
			{ID: 6, Title: recurrenceHistoryLabel},
			{ID: 8, Title: skippedLabel},
		},
	}
	client := &recurringClientStub{
		reads:      []taskRead{{task: live, etag: `"v2"`}},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{candidate}, Total: 1, Page: 1, PerPage: 1000, TotalPages: 1},
	}

	_, err := RepairRecurringSnapshot(context.Background(), client, RecurringRepairGrant{
		TaskID: 9, ProjectID: 7, LiveETag: `"v2"`, CompletionKey: "repair-key",
		Outcome: CompletionOutcomeCompleted,
	})
	if err == nil {
		t.Fatal("RepairRecurringSnapshot() error = nil, want conflicting outcome rejection")
	}
}
