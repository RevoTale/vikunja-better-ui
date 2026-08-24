package service

import (
	"context"
	"errors"
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
	key := capabilities.CompletionKey(9, completedAt, before.DueDate)
	created := vikunja.Task{
		ID: 12, ProjectID: 7, Title: "Water", Description: appendCompletionMetadata("Plants", key),
		Labels: []vikunja.Label{{ID: 4, Title: "garden"}, {ID: 6, Title: recurrenceHistoryLabel}},
	}
	confirmed := created
	confirmed.Done = true
	confirmed.DoneAt = completedAt
	client := &recurringClientStub{
		reads: []taskRead{
			{task: before, etag: `"v1"`}, {task: renewed, etag: `"v2"`}, {task: renewed, etag: `"v2"`},
			{task: created, etag: `"snapshot-v1"`}, {task: confirmed, etag: `"snapshot-v2"`},
		},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{}, Total: 0, Page: 1, PerPage: 1000, TotalPages: 0},
		created:    vikunja.Task{ID: 12, ProjectID: 7, Title: "Water"},
		labels:     []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}},
	}
	result, err := CompleteRecurring(context.Background(), client, capabilities, 9, beforeDue, time.UTC)
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
	if client.attachedLabels[8] {
		t.Fatalf("normal completion attached skipped marker: %#v", client.attachedLabels)
	}
}

func TestSkipRecurringCreatesSkippedSnapshotWithoutMarkingLiveTask(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	before := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Practice", DueDate: completedAt.Add(-time.Hour),
		RepeatAfter: 86400, RepeatMode: 2, Labels: []vikunja.Label{{ID: 4, Title: "practice"}},
	}
	renewed := before
	renewed.DueDate = completedAt.Add(24 * time.Hour)
	renewed.DoneAt = completedAt
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return completedAt })
	key := capabilities.CompletionKey(9, completedAt, before.DueDate)
	created := vikunja.Task{ID: 12, ProjectID: 7, Title: "Practice", Description: completionMetadata(key)}
	confirmed := created
	confirmed.Done = true
	confirmed.DoneAt = completedAt
	confirmed.Labels = []vikunja.Label{
		{ID: 4, Title: "practice"},
		{ID: 6, Title: recurrenceHistoryLabel},
		{ID: 8, Title: skippedLabel},
	}
	client := &recurringClientStub{
		reads: []taskRead{
			{task: before, etag: `"v1"`}, {task: renewed, etag: `"v2"`}, {task: renewed, etag: `"v2"`},
			{task: created, etag: `"snapshot-v1"`}, {task: confirmed, etag: `"snapshot-v2"`},
		},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{}, Page: 1, PerPage: 1000},
		created:    created,
		labels: []vikunja.Label{
			{ID: 6, Title: recurrenceHistoryLabel},
			{ID: 8, Title: skippedLabel},
		},
	}

	result, err := SkipRecurring(context.Background(), client, capabilities, 9, before.DueDate, time.UTC)
	if err != nil {
		t.Fatalf("SkipRecurring() error = %v", err)
	}
	if ClassifyTask(result.Snapshot).Outcome != CompletionOutcomeSkipped {
		t.Fatalf("snapshot = %#v", result.Snapshot)
	}
	if hasLabel(result.LiveTask.Labels, skippedLabel) {
		t.Fatalf("live task contains skipped marker: %#v", result.LiveTask.Labels)
	}
	if !client.attachedLabels[6] || !client.attachedLabels[8] {
		t.Fatalf("attached labels = %#v", client.attachedLabels)
	}
}

func TestCompleteRecurringKeepsDueTimeOnCompletionRelativeDate(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	actionAt := time.Date(2026, time.August, 16, 10, 0, 0, 0, location)
	beforeDue := time.Date(2026, time.August, 16, 20, 0, 0, 0, location)
	nativeDue := actionAt.Add(48 * time.Hour)
	targetDue := time.Date(2026, time.August, 18, 20, 0, 0, 0, location)
	marker := vikunja.Label{ID: 10, Title: fixedDueTimeLabel}
	before := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Read", DueDate: beforeDue,
		RepeatAfter: 2 * 86400, RepeatMode: 2, Labels: []vikunja.Label{marker},
	}
	native := before
	native.DueDate = nativeDue
	native.DoneAt = actionAt
	normalized := native
	normalized.DueDate = targetDue
	capabilities := NewCapabilityManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return actionAt },
	)
	key := capabilities.CompletionKey(9, actionAt, before.DueDate)
	created := vikunja.Task{ID: 12, ProjectID: 7, Title: "Read", Description: completionMetadata(key)}
	confirmed := created
	confirmed.Done = true
	confirmed.DoneAt = actionAt
	confirmed.Labels = []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}}
	client := &recurringClientStub{
		reads: []taskRead{
			{task: before, etag: `"v1"`},
			{task: native, etag: `"v2"`},
			{task: normalized, etag: `"v3"`},
			{task: normalized, etag: `"v3"`},
			{task: created, etag: `"snapshot-v1"`},
			{task: confirmed, etag: `"snapshot-v2"`},
		},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{}, Page: 1, PerPage: 1000},
		created:    created,
		labels:     []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}},
	}

	result, err := CompleteRecurring(context.Background(), client, capabilities, 9, beforeDue, location)
	if err != nil {
		t.Fatalf("CompleteRecurring() error = %v", err)
	}
	if !result.LiveTask.DueDate.Equal(targetDue) {
		t.Fatalf("live due = %s, want %s", result.LiveTask.DueDate, targetDue)
	}
	if len(client.patchDues) != 1 || !client.patchDues[0].Equal(targetDue) {
		t.Fatalf("due patches = %#v, want %s", client.patchDues, targetDue)
	}
	if client.attachedLabels[marker.ID] {
		t.Fatalf("fixed due time marker was copied to History: %#v", client.attachedLabels)
	}
}

func TestCompleteRecurringRejectsInvalidFixedDueTimeTargetBeforeWrite(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	actionAt := time.Date(2026, time.March, 7, 10, 0, 0, 0, location)
	before := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Read",
		DueDate:     time.Date(2026, time.March, 7, 2, 30, 0, 0, location),
		RepeatAfter: 86400, RepeatMode: 2,
		Labels: []vikunja.Label{{ID: 10, Title: fixedDueTimeLabel}},
	}
	client := &recurringClientStub{
		reads: []taskRead{{task: before, etag: `"v1"`}},
	}
	capabilities := NewCapabilityManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return actionAt },
	)

	_, err = CompleteRecurring(context.Background(), client, capabilities, 9, before.DueDate, location)
	if !errors.Is(err, ErrNonexistentLocalTime) || client.patchCalls != 0 {
		t.Fatalf("CompleteRecurring() error = %v, patches = %d", err, client.patchCalls)
	}
}

func TestCompleteRecurringReturnsRepairAfterFixedDueTimePatchFailure(t *testing.T) {
	t.Parallel()

	actionAt := time.Date(2026, time.August, 16, 10, 0, 0, 0, time.UTC)
	targetDue := time.Date(2026, time.August, 18, 20, 0, 0, 0, time.UTC)
	before := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Read",
		DueDate:     time.Date(2026, time.August, 16, 20, 0, 0, 0, time.UTC),
		RepeatAfter: 2 * 86400, RepeatMode: 2,
		Labels: []vikunja.Label{{ID: 10, Title: fixedDueTimeLabel}},
	}
	native := before
	native.DueDate = actionAt.Add(48 * time.Hour)
	native.DoneAt = actionAt
	wantErr := errors.New("normalization unavailable")
	client := &recurringClientStub{
		reads:     []taskRead{{task: before, etag: `"v1"`}, {task: native, etag: `"v2"`}},
		patchErrs: []error{nil, wantErr},
	}
	capabilities := NewCapabilityManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return actionAt },
	)

	result, err := CompleteRecurring(context.Background(), client, capabilities, 9, before.DueDate, time.UTC)
	if err != nil {
		t.Fatalf("CompleteRecurring() error = %v", err)
	}
	if !result.RepairRequired || result.LiveTask.ID != 9 || !errors.Is(result.RepairCause, wantErr) {
		t.Fatalf("CompleteRecurring() = %#v", result)
	}
	if !result.RepairGrant.NativeDueAt.Equal(native.DueDate) ||
		!result.RepairGrant.TargetDueAt.Equal(targetDue) {
		t.Fatalf("repair grant = %#v", result.RepairGrant)
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
	key := capabilities.CompletionKey(9, completedAt, before.DueDate)
	snapshot := vikunja.Task{
		ID: 12, ProjectID: 7, Title: "Water", Done: true, DoneAt: completedAt,
		Description: completionMetadata(key), Labels: []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}},
	}
	client := &recurringClientStub{
		reads: []taskRead{
			{task: before, etag: `"v1"`}, {task: renewed, etag: `"v2"`}, {task: renewed, etag: `"v2"`},
		},
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{snapshot}, Total: 1, Page: 1, PerPage: 1000, TotalPages: 1},
	}
	result, err := CompleteRecurring(context.Background(), client, capabilities, 9, before.DueDate, time.UTC)
	if err != nil || result.Snapshot.ID != 12 || client.createCalls != 0 {
		t.Fatalf("CompleteRecurring() = %#v, %v, creates=%d", result, err, client.createCalls)
	}
}

func TestCompleteRecurringRejectsStaleOccurrenceBeforeWrite(t *testing.T) {
	t.Parallel()

	dueAt := time.Date(2026, time.August, 16, 20, 0, 0, 0, time.UTC)
	before := vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Read", DueDate: dueAt,
		RepeatAfter: 86400, RepeatMode: 2,
	}
	client := &recurringClientStub{
		reads: []taskRead{{task: before, etag: `"v1"`}},
	}
	capabilities := NewCapabilityManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return dueAt.Add(-time.Hour) },
	)

	_, err := CompleteRecurring(
		context.Background(), client, capabilities, 9, dueAt.Add(-24*time.Hour), time.UTC,
	)
	if !errors.Is(err, ErrTaskStateChanged) || client.patchCalls != 0 {
		t.Fatalf("CompleteRecurring() error = %v, patches = %d", err, client.patchCalls)
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

func TestVerifyCompletionRelativeRenewalCanMoveBeforePreviousDue(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 16, 1, 30, 0, 0, time.UTC)
	before := vikunja.Task{
		ID: 9, DueDate: time.Date(2026, time.August, 18, 20, 0, 0, 0, time.UTC),
		RepeatAfter: 2 * 86400, RepeatMode: 2,
	}
	renewed := before
	renewed.DoneAt = completedAt
	renewed.DueDate = completedAt.Add(48 * time.Hour)

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
