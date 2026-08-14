package service

import (
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestClassifyTask(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		task         vikunja.Task
		wantKind     TaskKind
		wantDateOnly bool
		wantOutcome  CompletionOutcome
	}{
		{name: "one time", task: vikunja.Task{}, wantKind: TaskKindOneTime},
		{
			name:        "completed one time",
			task:        vikunja.Task{Done: true},
			wantKind:    TaskKindOneTime,
			wantOutcome: CompletionOutcomeCompleted,
		},
		{name: "job", task: taskWithLabels(jobLabel), wantKind: TaskKindJob},
		{name: "recurring", task: vikunja.Task{RepeatAfter: 86400}, wantKind: TaskKindRecurring},
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
			name:     "recurring job is invalid",
			task:     recurringTaskWithLabels(jobLabel),
			wantKind: TaskKindInvalid,
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
			name:     "history snapshot job is invalid",
			task:     taskWithDoneAndLabels(true, recurrenceHistoryLabel, jobLabel),
			wantKind: TaskKindInvalid,
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
				classification.Outcome != test.wantOutcome {
				t.Fatalf(
					"ClassifyTask() = %#v, want kind %q dateOnly %v outcome %q",
					classification,
					test.wantKind,
					test.wantDateOnly,
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

func recurringTaskWithLabels(titles ...string) vikunja.Task {
	return recurringTaskWithDoneAndLabels(false, titles...)
}

func recurringTaskWithDoneAndLabels(done bool, titles ...string) vikunja.Task {
	task := taskWithDoneAndLabels(done, titles...)
	task.RepeatAfter = 86400
	return task
}
