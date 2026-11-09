package mcp

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestExplicitEditPreservesOmittedFields(t *testing.T) {
	t.Parallel()
	due := time.Date(2026, time.November, 10, 12, 0, 15, 0, time.UTC)
	before := vikunja.Task{ID: 7, Title: "Before", Description: "<p>Keep</p>", Priority: 3, ProjectID: 2,
		DueDate: due, StartDate: due.Add(-time.Hour), RepeatAfter: 86400, RepeatMode: 2}
	edit, err := mergedEdit(before, editInput{ExpectedVersion: "version", Title: new("After")}, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	if edit.Title != "After" || edit.Description != before.Description || edit.ProjectID != 2 ||
		edit.Priority != 3 || edit.DueDate != "2026-11-10" || edit.DueTime != "12:00" ||
		edit.StartLocal != "2026-11-10T11:00" || edit.Recurrence == nil || edit.Recurrence.Interval != 1 ||
		edit.Reminders != nil || edit.LabelIDs != nil {
		t.Fatalf("omitted values changed: %#v", edit)
	}
}

func TestExplicitClearRejectsConflictingEdits(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1}
	for _, input := range []editInput{
		{Clear: []string{"deadline"}, DueDate: new("2026-11-10")},
		{Clear: []string{"startAt"}, StartAt: new("2026-11-10T12:00")},
		{Clear: []string{"unknown"}},
	} {
		if _, err := mergedEdit(before, input, time.UTC); err == nil {
			t.Fatal("conflicting edit accepted")
		}
	}
	edit, err := mergedEdit(before, editInput{Clear: []string{"deadline", "recurrence"},
		Reminders: []reminderInput{}, LabelIDs: []int64{}}, time.UTC)
	if err != nil || edit.DueDate != "" || edit.Recurrence != nil || edit.Reminders == nil || edit.LabelIDs == nil {
		t.Fatalf("explicit clearing not retained: %#v, %v", edit, err)
	}
}

func TestExplicitReplacementDoesNotDecodeUnsupportedOldRecurrence(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, RepeatAfter: 3600}
	for _, input := range []editInput{
		{Clear: []string{"recurrence"}},
		{Recurrence: &recurrenceInput{Interval: 1, Unit: "DAY", Mode: "SCHEDULED_CYCLE"}},
	} {
		if _, err := mergedEdit(before, input, time.UTC); err != nil {
			t.Fatal(err)
		}
	}
}
