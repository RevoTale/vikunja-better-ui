package service

import "testing"

func TestRecurringFrequencyMatchesUIRhythmExamples(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		interval     int
		unit         RecurrenceUnit
		period, want string
	}{
		{1, RecurrenceUnitDay, "WEEK", "7× / week"},
		{2, RecurrenceUnitWeek, "WEEK", "Less than once / week"},
		{1, RecurrenceUnitDay, "MONTH", "≈ 30.4× / month"},
		{1, RecurrenceUnitMonth, "YEAR", "12× / year"},
		{1, RecurrenceUnitWeek, "YEAR", "≈ 52.2× / year"},
		{0, RecurrenceUnitDay, "WEEK", "Frequency unavailable"},
	} {
		if got := RecurringFrequency(test.interval, test.unit, test.period); got != test.want {
			t.Errorf("got %q, want %q", got, test.want)
		}
	}
}
