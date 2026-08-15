package service

import (
	"errors"
	"testing"
	"time"
)

func TestResolveCompletionDateDueTimeUsesCompletionDateAndOriginalClock(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	dueAt := time.Date(2026, time.August, 16, 20, 15, 30, 0, location)

	for _, completedClock := range []string{"2026-08-16T10:00:00+03:00", "2026-08-16T21:00:00+03:00"} {
		completedAt, err := time.Parse(time.RFC3339, completedClock)
		if err != nil {
			t.Fatal(err)
		}
		resolved, err := resolveCompletionDateDueTime(completedAt, dueAt, 2*24*60*60, location)
		if err != nil {
			t.Fatalf("resolveCompletionDateDueTime() error = %v", err)
		}
		if got := resolved.In(location).Format("2006-01-02T15:04:05"); got != "2026-08-18T20:15:30" {
			t.Fatalf("resolved local due = %q", got)
		}
	}
}

func TestResolveCompletionDateDueTimePreservesWallTimeAcrossDST(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	completedAt := time.Date(2026, time.March, 7, 10, 0, 0, 0, location)
	dueAt := time.Date(2026, time.March, 7, 20, 0, 0, 0, location)
	resolved, err := resolveCompletionDateDueTime(completedAt, dueAt, 24*60*60, location)
	if err != nil {
		t.Fatalf("resolveCompletionDateDueTime() error = %v", err)
	}
	if got := resolved.In(location).Format("2006-01-02T15:04:05Z07:00"); got != "2026-03-08T20:00:00-04:00" {
		t.Fatalf("resolved local due = %q", got)
	}
}

func TestResolveCompletionDateDueTimeRejectsDSTGapAndFold(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name        string
		completedAt time.Time
		dueAt       time.Time
		wantErr     error
	}{
		{
			name:        "gap",
			completedAt: time.Date(2026, time.March, 7, 10, 0, 0, 0, location),
			dueAt:       time.Date(2026, time.March, 7, 2, 30, 0, 0, location),
			wantErr:     ErrNonexistentLocalTime,
		},
		{
			name:        "fold",
			completedAt: time.Date(2026, time.October, 31, 10, 0, 0, 0, location),
			dueAt:       time.Date(2026, time.October, 31, 1, 30, 0, 0, location),
			wantErr:     ErrAmbiguousLocalTime,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			_, err := resolveCompletionDateDueTime(test.completedAt, test.dueAt, 24*60*60, location)
			if !errors.Is(err, test.wantErr) {
				t.Fatalf("resolveCompletionDateDueTime() error = %v, want %v", err, test.wantErr)
			}
		})
	}
}

func TestResolveCompletionDateDueTimeRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	valid := time.Date(2026, time.August, 16, 20, 0, 0, 0, time.UTC)
	for _, test := range []struct {
		name        string
		completedAt time.Time
		dueAt       time.Time
		repeatAfter int64
		location    *time.Location
	}{
		{name: "missing completion", dueAt: valid, repeatAfter: 86400, location: time.UTC},
		{name: "missing due", completedAt: valid, repeatAfter: 86400, location: time.UTC},
		{name: "zero interval", completedAt: valid, dueAt: valid, location: time.UTC},
		{name: "partial day", completedAt: valid, dueAt: valid, repeatAfter: 3600, location: time.UTC},
		{name: "missing timezone", completedAt: valid, dueAt: valid, repeatAfter: 86400},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if _, err := resolveCompletionDateDueTime(
				test.completedAt,
				test.dueAt,
				test.repeatAfter,
				test.location,
			); err == nil {
				t.Fatal("resolveCompletionDateDueTime() error = nil")
			}
		})
	}
}
