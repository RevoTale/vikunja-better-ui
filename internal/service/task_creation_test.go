package service

import (
	"testing"
	"time"
)

func TestBuildJobTaskComputesDates(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	result, err := BuildJobTask(JobInput{
		Title: "Deploy", Description: "Production", Priority: 4,
		StartLocal: "2026-08-12T09:30", DurationMinutes: 90, CompletionWindowMinutes: 60,
	}, location)
	if err != nil {
		t.Fatalf("BuildJobTask() error = %v", err)
	}
	if result.StartDate == nil || result.EndDate == nil || result.DueDate == nil {
		t.Fatalf("BuildJobTask() = %#v", result)
	}
	if got := result.EndDate.In(location).Format("15:04"); got != "11:00" {
		t.Fatalf("end = %q", got)
	}
	if got := result.DueDate.In(location).Format("15:04"); got != "12:00" {
		t.Fatalf("due = %q", got)
	}
	if result.RepeatAfter != 0 || result.RepeatMode != 0 {
		t.Fatalf("job recurrence = %d/%d", result.RepeatAfter, result.RepeatMode)
	}
}

func TestBuildJobTaskAddsRecurringRule(t *testing.T) {
	t.Parallel()

	result, err := BuildJobTask(JobInput{
		Title: "Read a book", StartLocal: "2026-08-12T20:00",
		DurationMinutes: 60, CompletionWindowMinutes: 60,
		Interval: 2, Unit: RecurrenceUnitDay, Mode: RecurrenceModeFromCompletion,
		KeepDueTime: true,
	}, time.UTC)
	if err != nil {
		t.Fatalf("BuildJobTask() error = %v", err)
	}
	if result.RepeatAfter != 2*24*60*60 || result.RepeatMode != 2 {
		t.Fatalf("recurrence = %d/%d", result.RepeatAfter, result.RepeatMode)
	}
}

func TestBuildJobTaskRequiresStableTitleForRecurrence(t *testing.T) {
	t.Parallel()

	_, err := BuildJobTask(JobInput{
		StartLocal: "2026-08-12T20:00", DurationMinutes: 60, CompletionWindowMinutes: 60,
		Interval: 2, Unit: RecurrenceUnitDay, Mode: RecurrenceModeFromCompletion,
	}, time.UTC)
	if err == nil {
		t.Fatal("BuildJobTask() error = nil")
	}
}

func TestBuildJobTaskValidatesKeepTimeOfDay(t *testing.T) {
	t.Parallel()

	for _, input := range []JobInput{
		{
			Title: "Scheduled", StartLocal: "2026-08-12T20:00",
			DurationMinutes: 60, CompletionWindowMinutes: 60,
			Interval: 2, Unit: RecurrenceUnitDay, Mode: RecurrenceModeScheduled,
			KeepDueTime: true,
		},
		{
			Title: "Monthly", StartLocal: "2026-08-12T20:00",
			DurationMinutes: 60, CompletionWindowMinutes: 60,
			Interval: 1, Unit: RecurrenceUnitMonth, Mode: RecurrenceModeScheduled,
			KeepDueTime: true,
		},
	} {
		if _, err := BuildJobTask(input, time.UTC); err == nil {
			t.Fatalf("BuildJobTask(%#v) error = nil", input)
		}
	}
}

func TestBuildJobTaskDerivesMissingTitleFromLocalStart(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	result, err := BuildJobTask(JobInput{
		Title: "   ", StartLocal: "2026-08-12T09:30", DurationMinutes: 60, CompletionWindowMinutes: 60,
	}, location)
	if err != nil {
		t.Fatalf("BuildJobTask() error = %v", err)
	}
	if result.Title != "Job 12-08-2026 - 09:30" {
		t.Fatalf("BuildJobTask() title = %q", result.Title)
	}
}

func TestBuildOneTimeTaskUsesDateOnlyConvention(t *testing.T) {
	t.Parallel()

	result, dateOnly, err := BuildOneTimeTask(OneTimeInput{
		Title: "Pay bill", DueDate: "2026-08-12",
	}, time.UTC)
	if err != nil {
		t.Fatalf("BuildOneTimeTask() error = %v", err)
	}
	if !dateOnly || result.DueDate == nil || result.DueDate.Format(time.RFC3339) != "2026-08-12T23:59:59Z" {
		t.Fatalf("BuildOneTimeTask() = %#v, dateOnly = %v", result, dateOnly)
	}
}

func TestBuildOneTimeTaskRejectsTimeWithoutDate(t *testing.T) {
	t.Parallel()

	_, _, err := BuildOneTimeTask(OneTimeInput{Title: "Pay bill", DueTime: "12:00"}, time.UTC)
	if err == nil {
		t.Fatal("BuildOneTimeTask() error = nil")
	}
}

func TestBuildRecurringTaskCombinesDueAndRule(t *testing.T) {
	t.Parallel()

	result, dateOnly, err := BuildRecurringTask(RecurringInput{
		Title: "Water plants", FirstDueDate: "2026-08-12", DueTime: "09:15",
		Interval: 3, Unit: RecurrenceUnitDay, Mode: RecurrenceModeFromCompletion,
	}, time.UTC)
	if err != nil {
		t.Fatalf("BuildRecurringTask() error = %v", err)
	}
	if dateOnly || result.DueDate == nil || result.DueDate.Format(time.RFC3339) != "2026-08-12T09:15:00Z" {
		t.Fatalf("BuildRecurringTask() = %#v, dateOnly = %v", result, dateOnly)
	}
	if result.RepeatAfter != 3*24*60*60 || result.RepeatMode != 2 {
		t.Fatalf("recurrence = %d/%d", result.RepeatAfter, result.RepeatMode)
	}
}

func TestBuildRecurringTaskValidatesFixedDueTimeEligibility(t *testing.T) {
	t.Parallel()

	valid := RecurringInput{
		Title: "Water plants", FirstDueDate: "2026-08-12", DueTime: "09:15",
		Interval: 3, Unit: RecurrenceUnitDay, Mode: RecurrenceModeFromCompletion,
		KeepDueTime: true,
	}
	if _, _, err := BuildRecurringTask(valid, time.UTC); err != nil {
		t.Fatalf("BuildRecurringTask(valid) error = %v", err)
	}
	for _, input := range []RecurringInput{
		{
			Title: "Date only", FirstDueDate: "2026-08-12", Interval: 1,
			Unit: RecurrenceUnitDay, Mode: RecurrenceModeFromCompletion, KeepDueTime: true,
		},
		{
			Title: "Scheduled", FirstDueDate: "2026-08-12", DueTime: "09:15", Interval: 1,
			Unit: RecurrenceUnitDay, Mode: RecurrenceModeScheduled, KeepDueTime: true,
		},
		{
			Title: "Monthly", FirstDueDate: "2026-08-12", DueTime: "09:15", Interval: 1,
			Unit: RecurrenceUnitMonth, Mode: RecurrenceModeScheduled, KeepDueTime: true,
		},
	} {
		if _, _, err := BuildRecurringTask(input, time.UTC); err == nil {
			t.Fatalf("BuildRecurringTask(%#v) error = nil", input)
		}
	}
}

func TestBuildJobTaskRejectsInvalidDurations(t *testing.T) {
	t.Parallel()

	for _, input := range []JobInput{
		{Title: "Job", StartLocal: "2026-08-12T09:30", DurationMinutes: 0, CompletionWindowMinutes: 60},
		{Title: "Job", StartLocal: "2026-08-12T09:30", DurationMinutes: 60, CompletionWindowMinutes: 0},
	} {
		if _, err := BuildJobTask(input, time.UTC); err == nil {
			t.Fatalf("BuildJobTask(%#v) error = nil", input)
		}
	}
}

func TestBuildIntervalRecurrence(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name      string
		interval  int
		unit      RecurrenceUnit
		mode      RecurrenceMode
		wantAfter int64
		wantMode  int
	}{
		{name: "three days scheduled", interval: 3, unit: RecurrenceUnitDay, mode: RecurrenceModeScheduled, wantAfter: 3 * 24 * 60 * 60, wantMode: 0},
		{name: "two weeks from completion", interval: 2, unit: RecurrenceUnitWeek, mode: RecurrenceModeFromCompletion, wantAfter: 2 * 7 * 24 * 60 * 60, wantMode: 2},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			rule, err := BuildIntervalRecurrence(testCase.interval, testCase.unit, testCase.mode)
			if err != nil {
				t.Fatalf("BuildIntervalRecurrence() error = %v", err)
			}
			if rule.RepeatAfter != testCase.wantAfter || rule.RepeatMode != testCase.wantMode {
				t.Fatalf("BuildIntervalRecurrence() = %#v", rule)
			}
		})
	}
}

func TestBuildIntervalRecurrenceRejectsUnsupportedMonthCombinations(t *testing.T) {
	t.Parallel()

	for _, input := range []struct {
		interval int
		mode     RecurrenceMode
	}{
		{interval: 2, mode: RecurrenceModeScheduled},
		{interval: 1, mode: RecurrenceModeFromCompletion},
	} {
		if _, err := BuildIntervalRecurrence(input.interval, RecurrenceUnitMonth, input.mode); err == nil {
			t.Fatalf("BuildIntervalRecurrence(%d, MONTH, %s) error = nil", input.interval, input.mode)
		}
	}
}
