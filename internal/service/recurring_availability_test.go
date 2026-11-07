package service

import (
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestRecurringAvailabilityUsesFinalDueCalendarDay(t *testing.T) {
	location := kyivLocation(t)
	marker := vikunja.Label{ID: 10, Title: recurringAvailabilityLabel}
	for _, test := range []struct {
		name          string
		start, due    time.Time
		native, final time.Time
		wantStart     time.Time
		dateOnly      bool
	}{
		{"spring DST", localTime(location, 2026, time.March, 25, 0, 0),
			localTime(location, 2026, time.March, 28, 23, 59, 59),
			localTime(location, 2026, time.April, 4, 0, 59, 59), time.Time{},
			localTime(location, 2026, time.April, 1, 0, 0), true},
		{"late completion with fixed time", localTime(location, 2026, time.October, 20, 0, 0),
			localTime(location, 2026, time.October, 24, 18, 0),
			localTime(location, 2026, time.November, 2, 10, 0),
			localTime(location, 2026, time.November, 2, 18, 0),
			localTime(location, 2026, time.October, 29, 0, 0), false},
		{"monthly", localTime(location, 2026, time.January, 28, 0, 0),
			localTime(location, 2026, time.January, 31, 12, 0),
			localTime(location, 2026, time.March, 3, 12, 0), time.Time{},
			localTime(location, 2026, time.February, 28, 0, 0), false},
	} {
		t.Run(test.name, func(t *testing.T) {
			before := vikunja.Task{ID: 9, StartDate: test.start, DueDate: test.due,
				RepeatAfter: 86400, Labels: []vikunja.Label{marker}}
			if test.dateOnly {
				before.Labels = append(before.Labels, vikunja.Label{ID: 11, Title: dateOnlyLabel})
			}
			native := before
			native.DueDate = test.native
			want := native
			want.StartDate = test.wantStart
			if !test.final.IsZero() {
				want.DueDate = test.final
			} else if test.dateOnly {
				local := test.native.In(location)
				want.DueDate = time.Date(local.Year(), local.Month(), local.Day(), 23, 59, 59, 0, location)
			}
			client := &recurringClientStub{}
			client.reads = []taskRead{{task: want, etag: `"v3"`}}
			got, grant, err := normalizeRecurringAvailability(t.Context(), client, before, native, `"v2"`,
				test.final, location, RecurringRepairGrant{})
			if err != nil || !got.StartDate.Equal(want.StartDate) || !got.DueDate.Equal(want.DueDate) ||
				!grant.TargetStartAt.Equal(want.StartDate) || !grant.TargetDueAt.Equal(want.DueDate) {
				t.Fatalf("normalization = %#v, grant = %#v, error = %v", got, grant, err)
			}
		})
	}
}

func TestRecurringAvailabilityRepairDoesNotRenewAgain(t *testing.T) {
	now := time.Date(2026, time.November, 4, 12, 0, 0, 0, time.UTC)
	native := vikunja.Task{ID: 9, ProjectID: 7, Title: "Read", StartDate: now.Add(-48 * time.Hour),
		DueDate: now.Add(24 * time.Hour), DoneAt: now, RepeatAfter: 86400, RepeatMode: 2,
		Labels: []vikunja.Label{{ID: 10, Title: recurringAvailabilityLabel}}}
	target := native
	target.StartDate = now.Add(-24 * time.Hour)
	key := "availability-repair"
	snapshot := vikunja.Task{ID: 12, ProjectID: 7, Done: true, DoneAt: now,
		Description: completionMetadata(key), Labels: []vikunja.Label{{ID: 6, Title: recurrenceHistoryLabel}}}
	client := &recurringClientStub{searchPage: vikunja.TaskPage{Items: []vikunja.Task{snapshot}}}
	client.reads = []taskRead{{task: native, etag: `"v2"`}, {task: target, etag: `"v3"`},
		{task: snapshot, etag: `"snapshot"`}}
	grant := RecurringRepairGrant{TaskID: 9, ProjectID: 7, CompletionKey: key, Outcome: CompletionOutcomeCompleted,
		RenewedDoneAt: now, NativeStartAt: native.StartDate, NativeDueAt: native.DueDate,
		TargetStartAt: target.StartDate, TargetDueAt: target.DueDate, RepeatAfter: 86400, RepeatMode: 2}
	result, err := RepairRecurringSnapshot(t.Context(), client, grant)
	if err != nil || !result.LiveTask.StartDate.Equal(target.StartDate) ||
		client.patchCalls != 1 || client.patchDone != nil {
		t.Fatalf("repair = %#v, error = %v, patches = %d", result, err, client.patchCalls)
	}
	changed := native
	changed.StartDate = changed.StartDate.Add(time.Hour)
	client.reads = []taskRead{{task: changed, etag: `"v4"`}}
	client.readCalls = 0
	if _, err := RepairRecurringSnapshot(t.Context(), client, grant); !errors.Is(err, ErrTaskStateChanged) {
		t.Fatalf("changed schedule repair = %v", err)
	}
	changed = native
	changed.Labels = nil
	client.reads = []taskRead{{task: changed, etag: `"v5"`}}
	client.readCalls = 0
	if _, err := RepairRecurringSnapshot(t.Context(), client, grant); !errors.Is(err, ErrTaskStateChanged) {
		t.Fatalf("removed marker repair = %v", err)
	}
	if snapshotLabelAllowed(recurringAvailabilityLabel) {
		t.Fatal("availability marker must not be copied to snapshots")
	}
}

func TestRecurringAvailabilityFailureReturnsRepairForCompleteAndSkip(t *testing.T) {
	now := time.Date(2026, time.November, 4, 12, 0, 0, 0, time.UTC)
	before := vikunja.Task{ID: 9, ProjectID: 7, Title: "Read", StartDate: now.AddDate(0, 0, -5),
		DueDate: now.AddDate(0, 0, -3), RepeatAfter: 86400, RepeatMode: 2,
		Labels: []vikunja.Label{{ID: 10, Title: recurringAvailabilityLabel}}}
	native := before
	native.DoneAt, native.DueDate = now, now.Add(24*time.Hour)
	failure := errors.New("normalization unavailable")
	for _, action := range []struct {
		name string
		run  func(*recurringClientStub, *CapabilityManager) (RecurringCompletion, error)
	}{
		{"complete", func(client *recurringClientStub, capabilities *CapabilityManager) (RecurringCompletion, error) {
			return CompleteRecurring(t.Context(), client, capabilities, 9, before.DueDate, time.UTC)
		}},
		{"skip", func(client *recurringClientStub, capabilities *CapabilityManager) (RecurringCompletion, error) {
			return SkipRecurring(t.Context(), client, capabilities, 9, before.DueDate, time.UTC)
		}},
	} {
		t.Run(action.name, func(t *testing.T) {
			client := &recurringClientStub{}
			client.reads = []taskRead{{task: before, etag: `"v1"`}, {task: native, etag: `"v2"`}}
			client.patchErrs = []error{nil, failure}
			capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
			result, err := action.run(client, capabilities)
			wantStart := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
			if err != nil || !result.RepairRequired || !errors.Is(result.RepairCause, failure) ||
				!result.RepairGrant.TargetStartAt.Equal(wantStart) || client.patchCalls != 2 || client.createCalls != 0 {
				t.Fatalf("result = %#v, error = %v, patches = %d", result, err, client.patchCalls)
			}
		})
	}
}

func TestRecurringAvailabilityUsesFirstInstantAfterMissingMidnight(t *testing.T) {
	location, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		t.Fatal(err)
	}
	before := vikunja.Task{ID: 9, StartDate: time.Date(2018, 10, 31, 0, 0, 0, 0, location),
		DueDate: time.Date(2018, 11, 1, 12, 0, 0, 0, location), RepeatAfter: recurrenceDaySeconds,
		Labels: []vikunja.Label{{Title: recurringAvailabilityLabel}}}
	native := before
	native.DueDate = time.Date(2018, 11, 5, 12, 0, 0, 0, location)
	want := native
	want.StartDate = time.Date(2018, 11, 4, 1, 0, 0, 0, location)
	client := &recurringClientStub{}
	client.reads = []taskRead{{task: want, etag: `"v3"`}}
	result, grant, err := normalizeRecurringAvailability(t.Context(), client, before, native,
		`"v2"`, native.DueDate, location, RecurringRepairGrant{TargetDueAt: native.DueDate})
	if err != nil || !result.StartDate.Equal(want.StartDate) || !grant.TargetStartAt.Equal(want.StartDate) {
		t.Fatalf("missing midnight: result = %#v, grant = %#v, error = %v", result, grant, err)
	}
}

func TestFirstAvailableLocalDayAcrossTimezoneTransitions(t *testing.T) {
	for _, test := range []struct {
		zone, day, want string
	}{
		{"America/Sao_Paulo", "2018-11-04", "2018-11-04T01:00:00-02:00"},
		{"Pacific/Apia", "2011-12-30", "2011-12-31T00:00:00+14:00"},
		{"America/Havana", "2018-11-04", "2018-11-04T00:00:00-04:00"},
	} {
		t.Run(test.zone, func(t *testing.T) {
			location, err := time.LoadLocation(test.zone)
			if err != nil {
				t.Fatal(err)
			}
			day, err := time.Parse(localDateLayout, test.day)
			if err != nil {
				t.Fatal(err)
			}
			got, err := firstAvailableLocalDay(day, location)
			if err != nil || got.In(location).Format(time.RFC3339) != test.want {
				t.Fatalf("start = %v, error = %v, want %s", got.In(location), err, test.want)
			}
		})
	}
}
