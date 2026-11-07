package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestPlanningClockBoundaries(t *testing.T) {
	t.Parallel()
	location := kyivLocation(t)
	for _, test := range []struct {
		day, start, end string
		valid           bool
	}{
		{"2026-11-12", "14:00", "15:00", true},
		{"2026-11-12", "15:00", "14:00", false},
		{"2026-11-12", "14:00", "14:00", false},
		{"2026-03-29", "03:30", "15:00", false},
		{"2026-10-25", "03:30", "15:00", false},
	} {
		write, _, err := BuildOneTimeTask(OneTimeInput{Title: "Plan", Planning: &PlanningWindowInput{
			StartsOn: test.day, EndsOn: test.day, StartsAtTime: test.start, EndsAtTime: test.end,
		}}, location)
		if (err == nil) != test.valid {
			t.Fatalf("%+v: %v", test, err)
		}
		if test.valid && (write.StartDate.In(location).Format("15:04") != test.start ||
			write.EndDate.In(location).Format("15:04") != test.end) {
			t.Fatalf("clock changed: %+v", write)
		}
	}
}

func TestRecurringAvailabilityClockCreationAndRenewal(t *testing.T) {
	t.Parallel()
	location := kyivLocation(t)
	write, _, err := BuildRecurringTask(RecurringInput{Title: "Read", AvailableFrom: "2026-03-24",
		AvailableFromTime: "14:00", FirstDueDate: "2026-03-26", Interval: 1,
		Unit: RecurrenceUnitWeek, Mode: RecurrenceModeScheduled}, location)
	if err != nil {
		t.Fatal(err)
	}
	before := vikunja.Task{StartDate: *write.StartDate}
	day := time.Date(2026, time.March, 31, 0, 0, 0, 0, time.UTC)
	renewed, err := renewedAvailabilityStart(day, before, location)
	if err != nil || renewed.In(location).Format("2006-01-02T15:04") != "2026-03-31T14:00" {
		t.Fatalf("renewed = %v, error = %v", renewed, err)
	}
	before.StartDate = time.Date(2026, time.March, 22, 3, 30, 0, 0, location)
	if _, err := renewedAvailabilityStart(day.AddDate(0, 0, -2), before, location); err == nil {
		t.Fatal("nonexistent renewal clock accepted")
	}
}
