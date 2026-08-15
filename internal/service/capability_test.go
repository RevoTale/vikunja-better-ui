package service

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestUndoCapabilityRoundTrip(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	manager := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	token, expiresAt, err := manager.IssueUndo("session-1", UndoGrant{
		TaskID: 9, Kind: TaskKindJob, DoneAt: now.Add(-time.Second), ETag: `"v2"`,
	})
	if err != nil {
		t.Fatalf("IssueUndo() error = %v", err)
	}
	if !expiresAt.Equal(now.Add(30 * time.Second)) {
		t.Fatalf("expiresAt = %v", expiresAt)
	}
	grant, err := manager.ParseUndo("session-1", token)
	if err != nil {
		t.Fatalf("ParseUndo() error = %v", err)
	}
	if grant.TaskID != 9 || grant.Kind != TaskKindJob || grant.ETag != `"v2"` || !grant.DoneAt.Equal(now.Add(-time.Second)) {
		t.Fatalf("ParseUndo() = %#v", grant)
	}
}

func TestUndoCapabilityRejectsWrongSessionTamperAndExpiry(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	manager := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	token, _, err := manager.IssueUndo("session-1", UndoGrant{
		TaskID: 9, Kind: TaskKindOneTime, DoneAt: now, ETag: `"v2"`,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.ParseUndo("session-2", token); !errors.Is(err, ErrInvalidCapability) {
		t.Fatalf("wrong-session error = %v", err)
	}
	if _, err := manager.ParseUndo("session-1", token+"x"); !errors.Is(err, ErrInvalidCapability) {
		t.Fatalf("tamper error = %v", err)
	}

	now = now.Add(31 * time.Second)
	if _, err := manager.ParseUndo("session-1", token); !errors.Is(err, ErrExpiredCapability) {
		t.Fatalf("expiry error = %v", err)
	}
}

func TestMarkerRepairCapabilityRoundTrip(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	manager := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	token, err := manager.IssueMarkerRepair("session-1", MarkerRepairGrant{
		TaskID: 11, MarkerTitle: dateOnlyLabel, ETag: `"v1"`,
	})
	if err != nil {
		t.Fatalf("IssueMarkerRepair() error = %v", err)
	}
	grant, err := manager.ParseMarkerRepair("session-1", token)
	if err != nil {
		t.Fatalf("ParseMarkerRepair() error = %v", err)
	}
	if grant.TaskID != 11 || grant.MarkerTitle != dateOnlyLabel || grant.ETag != `"v1"` {
		t.Fatalf("ParseMarkerRepair() = %#v", grant)
	}
}

func TestCompletionKeyIsDeterministicAndOccurrenceBound(t *testing.T) {
	t.Parallel()

	manager := NewCapabilityManager([]byte("01234567890123456789012345678901"), time.Now)
	completedAt := time.Date(2026, time.August, 12, 12, 0, 0, 123, time.UTC)
	dueAt := time.Date(2026, time.August, 12, 20, 0, 0, 0, time.UTC)
	first := manager.CompletionKey(9, completedAt, dueAt)
	second := manager.CompletionKey(9, completedAt, dueAt)
	otherCompletion := manager.CompletionKey(9, completedAt.Add(time.Nanosecond), dueAt)
	otherOccurrence := manager.CompletionKey(9, completedAt, dueAt.Add(24*time.Hour))
	if first == "" || first != second || first == otherCompletion || first == otherOccurrence {
		t.Fatalf("keys = %q, %q, %q, %q", first, second, otherCompletion, otherOccurrence)
	}
}

func TestRecurringRepairCapabilityIsOpaqueAndRoundTrips(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	manager := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	want := RecurringRepairGrant{
		TaskID: 9, ProjectID: 7, LiveETag: `"v2"`, CompletionKey: "completion-key",
		DueAt: now.Add(-time.Hour), StartAt: now.Add(-2 * time.Hour), EndAt: now.Add(-90 * time.Minute),
		Outcome: CompletionOutcomeSkipped, RenewedDoneAt: now,
		NativeDueAt: now.Add(48 * time.Hour), TargetDueAt: now.Add(58 * time.Hour),
		RepeatAfter: 2 * 86400, RepeatMode: 2,
	}
	token, err := manager.IssueRecurringRepair("session-1", want)
	if err != nil {
		t.Fatalf("IssueRecurringRepair() error = %v", err)
	}
	if strings.Contains(token, "completion-key") || strings.Contains(token, want.DueAt.Format(time.RFC3339)) {
		t.Fatalf("capability exposes repair state: %q", token)
	}
	got, err := manager.ParseRecurringRepair("session-1", token)
	if err != nil {
		t.Fatalf("ParseRecurringRepair() error = %v", err)
	}
	if got != want {
		t.Fatalf("ParseRecurringRepair() = %#v, want %#v", got, want)
	}
}
