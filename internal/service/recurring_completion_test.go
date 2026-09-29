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
	capabilities := NewCapabilityManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return completedAt },
	)
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
	assertCreatedSnapshot(t, client, result.CompletionKey)
}

func assertCreatedSnapshot(t *testing.T, client *recurringClientStub, key string) {
	t.Helper()
	if client.patchCalls != 2 || client.patchCheck.Done == nil ||
		*client.patchCheck.Done ||
		client.patchDone == nil ||
		!*client.patchDone {
		t.Fatalf("patches = %d, last check = %#v, done = %v", client.patchCalls, client.patchCheck, client.patchDone)
	}
	if client.createInput.RepeatAfter != 0 || client.createInput.RepeatMode != 0 || client.createInput.Done {
		t.Fatalf("snapshot input = %#v", client.createInput)
	}
	if !strings.Contains(client.createInput.Description, key) {
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
	capabilities := NewCapabilityManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return completedAt },
	)
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

func TestCompleteRecurringJobKeepsStartTimeOfDayAndJobHistory(t *testing.T) {
	t.Parallel()

	completedAt := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	before := recurringJobAt(
		time.Date(2026, time.August, 10, 9, 0, 0, 0, time.UTC),
		2*recurrenceDaySeconds,
		2,
	)
	before.ID = 9
	before.ProjectID = 7
	before.Title = "Read a book"
	before.Labels = append(before.Labels, vikunja.Label{ID: 10, Title: fixedDueTimeLabel})
	native := before
	native.StartDate = time.Date(2026, time.August, 14, 10, 0, 0, 0, time.UTC)
	native.EndDate = native.StartDate.Add(time.Hour)
	native.DueDate = completedAt.Add(48 * time.Hour)
	native.DoneAt = completedAt
	targetStart := time.Date(2026, time.August, 14, 9, 0, 0, 0, time.UTC)
	normalized := native
	normalized.StartDate = targetStart
	normalized.EndDate = targetStart.Add(time.Hour)
	normalized.DueDate = targetStart.Add(2 * time.Hour)

	capabilities := NewCapabilityManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return completedAt },
	)
	key := capabilities.CompletionKey(before.ID, completedAt, before.DueDate)
	created := vikunja.Task{
		ID: 12, ProjectID: 7, Title: before.Title, Description: completionMetadata(key),
	}
	confirmed := vikunja.Task{
		ID: created.ID, ProjectID: created.ProjectID, Title: created.Title, Description: created.Description,
		Done: true, DoneAt: completedAt,
		StartDate: before.StartDate, EndDate: before.EndDate, DueDate: before.DueDate,
		Labels: []vikunja.Label{{ID: 1, Title: jobLabel}, {ID: 6, Title: recurrenceHistoryLabel}},
	}
	client := &recurringClientStub{
		searchPage: vikunja.TaskPage{Items: []vikunja.Task{}, Page: 1, PerPage: 1000},
		created:    created,
		labels:     []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}},
	}
	client.reads = []taskRead{
		{task: before, etag: `"v1"`},
		{task: native, etag: `"v2"`},
		{task: normalized, etag: `"v3"`},
		{task: normalized, etag: `"v3"`},
		{task: created, etag: `"snapshot-v1"`},
		{task: confirmed, etag: `"snapshot-v2"`},
	}

	result, err := CompleteRecurring(context.Background(), client, capabilities, before.ID, before.DueDate, time.UTC)
	if err != nil {
		t.Fatalf("CompleteRecurring() error = %v", err)
	}
	assertCompletedRecurringJob(t, result, normalized, client)
}

func assertCompletedRecurringJob(
	t *testing.T, result RecurringCompletion, normalized vikunja.Task, client *recurringClientStub,
) {
	t.Helper()
	if !result.LiveTask.StartDate.Equal(normalized.StartDate) ||
		!result.LiveTask.EndDate.Equal(normalized.EndDate) ||
		!result.LiveTask.DueDate.Equal(normalized.DueDate) {
		t.Fatalf("live task = %#v", result.LiveTask)
	}
	if ClassifyTask(result.LiveTask).Kind != TaskKindJob || !ClassifyTask(result.LiveTask).Recurring {
		t.Fatalf("live classification = %#v", ClassifyTask(result.LiveTask))
	}
	if ClassifyTask(result.Snapshot).Kind != TaskKindJob ||
		ClassifyTask(result.Snapshot).Outcome != CompletionOutcomeCompleted {
		t.Fatalf("snapshot classification = %#v", ClassifyTask(result.Snapshot))
	}
	if len(client.patchSchedules) != 1 || client.patchSchedules[0] != (jobSchedule{
		StartAt: normalized.StartDate, EndAt: normalized.EndDate, DueAt: normalized.DueDate,
	}) {
		t.Fatalf("schedule patches = %#v", client.patchSchedules)
	}
	if client.attachedLabels[10] {
		t.Fatalf("fixed-time marker was copied to History: %#v", client.attachedLabels)
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
	capabilities := NewCapabilityManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return completedAt },
	)
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
