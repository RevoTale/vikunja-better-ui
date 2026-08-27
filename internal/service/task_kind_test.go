package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestClassifyTask(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		task             vikunja.Task
		wantKind         TaskKind
		wantDateOnly     bool
		wantFixedDueTime bool
		wantRecurring    bool
		wantOutcome      CompletionOutcome
	}{
		{name: "one time", task: vikunja.Task{}, wantKind: TaskKindOneTime},
		{
			name:        "completed one time",
			task:        vikunja.Task{Done: true},
			wantKind:    TaskKindOneTime,
			wantOutcome: CompletionOutcomeCompleted,
		},
		{name: "job", task: taskWithLabels(jobLabel), wantKind: TaskKindJob},
		{
			name: "recurring", task: vikunja.Task{RepeatAfter: 86400},
			wantKind: TaskKindRecurring, wantRecurring: true,
		},
		{
			name: "recurring job",
			task: vikunja.Task{
				StartDate:   time.Date(2026, time.August, 15, 9, 0, 0, 0, time.UTC),
				EndDate:     time.Date(2026, time.August, 15, 10, 0, 0, 0, time.UTC),
				DueDate:     time.Date(2026, time.August, 15, 11, 0, 0, 0, time.UTC),
				RepeatAfter: 2 * 86400,
				Labels:      []vikunja.Label{{ID: 1, Title: jobLabel}},
			},
			wantKind: TaskKindJob, wantRecurring: true,
		},
		{
			name: "fixed start time recurring job",
			task: vikunja.Task{
				StartDate:   time.Date(2026, time.August, 15, 9, 0, 0, 0, time.UTC),
				EndDate:     time.Date(2026, time.August, 15, 10, 0, 0, 0, time.UTC),
				DueDate:     time.Date(2026, time.August, 15, 11, 0, 0, 0, time.UTC),
				RepeatAfter: 2 * 86400, RepeatMode: 2,
				Labels: []vikunja.Label{{ID: 1, Title: jobLabel}, {ID: 2, Title: fixedDueTimeLabel}},
			},
			wantKind: TaskKindJob, wantRecurring: true, wantFixedDueTime: true,
		},
		{
			name: "fixed due time recurrence",
			task: vikunja.Task{
				DueDate:     time.Date(2026, time.August, 15, 20, 0, 0, 0, time.UTC),
				RepeatAfter: 86400, RepeatMode: 2,
				Labels: []vikunja.Label{{ID: 1, Title: fixedDueTimeLabel}},
			},
			wantKind: TaskKindRecurring, wantFixedDueTime: true, wantRecurring: true,
		},
		{
			name: "fixed due time scheduled recurrence is invalid",
			task: vikunja.Task{
				DueDate:     time.Date(2026, time.August, 15, 20, 0, 0, 0, time.UTC),
				RepeatAfter: 86400,
				Labels:      []vikunja.Label{{ID: 1, Title: fixedDueTimeLabel}},
			},
			wantKind: TaskKindInvalid, wantFixedDueTime: true,
		},
		{
			name: "fixed due time date-only recurrence is invalid",
			task: vikunja.Task{
				DueDate:     time.Date(2026, time.August, 15, 23, 59, 59, 0, time.UTC),
				RepeatAfter: 86400, RepeatMode: 2,
				Labels: []vikunja.Label{
					{ID: 1, Title: fixedDueTimeLabel}, {ID: 2, Title: dateOnlyLabel},
				},
			},
			wantKind: TaskKindInvalid, wantDateOnly: true, wantFixedDueTime: true,
		},
		{
			name: "fixed due time completed recurrence is invalid",
			task: vikunja.Task{
				Done: true, DueDate: time.Date(2026, time.August, 15, 20, 0, 0, 0, time.UTC),
				RepeatAfter: 86400, RepeatMode: 2,
				Labels: []vikunja.Label{{ID: 1, Title: fixedDueTimeLabel}},
			},
			wantKind: TaskKindInvalid, wantFixedDueTime: true,
		},
		{
			name:        "completed recurrence snapshot",
			task:        taskWithDoneAndLabels(true, recurrenceHistoryLabel),
			wantKind:    TaskKindRecurring,
			wantOutcome: CompletionOutcomeCompleted,
		},
		{
			name:        "skipped recurrence snapshot",
			task:        taskWithDoneAndLabels(true, recurrenceHistoryLabel, skippedLabel),
			wantKind:    TaskKindRecurring,
			wantOutcome: CompletionOutcomeSkipped,
		},
		{
			name:         "date only is independent",
			task:         taskWithLabels(dateOnlyLabel),
			wantKind:     TaskKindOneTime,
			wantDateOnly: true,
		},
		{
			name:     "incomplete history snapshot is invalid",
			task:     taskWithLabels(recurrenceHistoryLabel),
			wantKind: TaskKindInvalid,
		},
		{
			name:     "history snapshot with recurrence is invalid",
			task:     recurringTaskWithDoneAndLabels(true, recurrenceHistoryLabel),
			wantKind: TaskKindInvalid,
		},
		{
			name:        "history snapshot job",
			task:        taskWithDoneAndLabels(true, recurrenceHistoryLabel, jobLabel),
			wantKind:    TaskKindJob,
			wantOutcome: CompletionOutcomeCompleted,
		},
		{
			name:     "active skipped marker is invalid",
			task:     taskWithLabels(skippedLabel),
			wantKind: TaskKindInvalid,
		},
		{
			name:     "completed skipped marker without history is invalid",
			task:     taskWithDoneAndLabels(true, skippedLabel),
			wantKind: TaskKindInvalid,
		},
		{
			name:     "active skipped history is invalid",
			task:     taskWithLabels(recurrenceHistoryLabel, skippedLabel),
			wantKind: TaskKindInvalid,
		},
		{
			name:     "recurring skipped history is invalid",
			task:     recurringTaskWithDoneAndLabels(true, recurrenceHistoryLabel, skippedLabel),
			wantKind: TaskKindInvalid,
		},
		{
			name:     "marker matching is exact and case sensitive",
			task:     taskWithLabels("Job", " vbu:date-only "),
			wantKind: TaskKindOneTime,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			classification := ClassifyTask(test.task)
			if classification.Kind != test.wantKind || classification.DateOnly != test.wantDateOnly ||
				classification.FixedDueTime != test.wantFixedDueTime ||
				classification.Recurring != test.wantRecurring ||
				classification.Outcome != test.wantOutcome {
				t.Fatalf(
					"ClassifyTask() = %#v, want kind %q dateOnly %v fixedDueTime %v recurring %v outcome %q",
					classification,
					test.wantKind,
					test.wantDateOnly,
					test.wantFixedDueTime,
					test.wantRecurring,
					test.wantOutcome,
				)
			}
		})
	}
}

func taskWithLabels(titles ...string) vikunja.Task {
	return taskWithDoneAndLabels(false, titles...)
}

func taskWithDoneAndLabels(done bool, titles ...string) vikunja.Task {
	labels := make([]vikunja.Label, 0, len(titles))
	for index, title := range titles {
		labels = append(labels, vikunja.Label{ID: int64(index + 1), Title: title})
	}
	return vikunja.Task{Done: done, Labels: labels}
}

func recurringTaskWithDoneAndLabels(done bool, titles ...string) vikunja.Task {
	task := taskWithDoneAndLabels(done, titles...)
	task.RepeatAfter = 86400
	return task
}
