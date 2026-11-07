package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestReminderInputsPreserveClearAndResolve(t *testing.T) {
	t.Parallel()
	location := kyivLocation(t)
	task := vikunja.TaskWrite{}
	omitted, err := BuildReminders(nil, task, location)
	if err != nil || omitted != nil {
		t.Fatal("omitted reminders must remain omitted")
	}
	cleared, err := BuildReminders([]ReminderInput{}, task, location)
	if err != nil || cleared == nil || len(*cleared) != 0 {
		t.Fatal("empty list must explicitly clear reminders")
	}
	exact := time.Date(2026, 11, 10, 8, 9, 37, 0, time.UTC)
	inputs := []ReminderInput{{At: &exact}, {LocalAt: "2026-11-11T14:00"}}
	reminders, err := BuildReminders(inputs, task, location)
	if err != nil {
		t.Fatal(err)
	}
	if !(*reminders)[0].Reminder.Equal(exact) || (*reminders)[1].Reminder.In(location).Format("15:04") != "14:00" {
		t.Fatal("reminder timezone or imported seconds changed")
	}
	actual := []vikunja.TaskReminder{(*reminders)[1], (*reminders)[0]}
	if !RemindersMatch(actual, reminders) || !RemindersMatch(nil, cleared) {
		t.Fatal("native ordering/null rejected")
	}
	actual[0].Reminder = actual[0].Reminder.Add(time.Second)
	if RemindersMatch(actual, reminders) {
		t.Fatal("unconfirmed reminder accepted")
	}
}

func TestReminderValidation(t *testing.T) {
	t.Parallel()
	at := time.Date(2026, 11, 10, 8, 0, 0, 0, time.UTC)
	for _, inputs := range [][]ReminderInput{
		{{}},
		{{At: &at, LocalAt: "2026-11-10T08:00"}},
		{{LocalAt: "2026-03-29T03:30"}},
		{{LocalAt: "2026-10-25T03:30"}},
		{{At: &at}, {At: &at}},
		{{RelativeTo: "invalid"}},
		{{At: &at, RelativePeriod: 60}},
	} {
		if _, err := BuildReminders(inputs, vikunja.TaskWrite{}, kyivLocation(t)); err == nil {
			t.Fatalf("accepted invalid reminders: %+v", inputs)
		}
	}
}

func TestRelativeReminderPreservesRuleAndRecalculatesAnchor(t *testing.T) {
	t.Parallel()
	due := time.Date(2026, 11, 10, 8, 0, 0, 0, time.UTC)
	task := vikunja.TaskWrite{DueDate: &due}
	input := []ReminderInput{{At: &due, RelativeTo: "due_date", RelativePeriod: -3600}}
	reminders, err := BuildReminders(input, task, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	got := (*reminders)[0]
	if got.RelativeTo != "due_date" || got.RelativePeriod != -3600 || !got.Reminder.Equal(due.Add(-time.Hour)) {
		t.Fatalf("relative reminder changed: %+v", got)
	}
	missing, err := BuildReminders(input, vikunja.TaskWrite{}, time.UTC)
	if err != nil || !(*missing)[0].Reminder.IsZero() {
		t.Fatal("missing native anchor must preserve an inactive rule")
	}
	before := vikunja.Task{ID: 1, Reminders: []vikunja.TaskReminder{got}}
	after := before
	after.Reminders = nil
	if TaskVersion(before) == TaskVersion(after) {
		t.Fatal("version ignores reminders")
	}
}
