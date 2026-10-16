package resolver

import (
	"testing"
	"time"
)

func TestReuseScheduleUsesVikunjaLocalDateAndKeepsDateOnlyUntimed(t *testing.T) {
	t.Parallel()
	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	instant := time.Date(2026, 10, 24, 22, 15, 0, 0, time.UTC)
	date, clock := reuseSchedule(instant, location, false)
	if date == nil || string(*date) != "2026-10-25" || clock == nil || string(*clock) != "01:15" {
		t.Fatalf("incorrect local suggestion: %v %v", date, clock)
	}
	date, clock = reuseSchedule(instant, location, true)
	if date == nil || string(*date) != "2026-10-25" || clock != nil {
		t.Fatal("date-only task exposed a hidden deadline time")
	}
	if date, clock = reuseSchedule(time.Time{}, location, false); date != nil || clock != nil {
		t.Fatal("missing schedule produced a reusable value")
	}
	// The offset changes after DST; midnight remains a real reusable time.
	instant = time.Date(2026, 10, 25, 22, 0, 0, 0, time.UTC)
	date, clock = reuseSchedule(instant, location, false)
	if date == nil || string(*date) != "2026-10-26" || clock == nil || string(*clock) != "00:00" {
		t.Fatal("incorrect date rollover or midnight after DST")
	}
}
