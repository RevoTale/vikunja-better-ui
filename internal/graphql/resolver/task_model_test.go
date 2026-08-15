package resolver

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestTaskModelMapsCompletionOutcome(t *testing.T) {
	t.Parallel()

	projects := map[int64]vikunja.Project{7: {ID: 7, Title: "Home"}}
	completed, err := taskModel(vikunja.Task{
		ID: 9, ProjectID: 7, Done: true,
	}, projects, "UTC", time.Now(), 7)
	if err != nil {
		t.Fatalf("taskModel(completed) error = %v", err)
	}
	if completed.CompletionOutcome == nil || *completed.CompletionOutcome != model.CompletionOutcomeCompleted {
		t.Fatalf("completed outcome = %#v", completed.CompletionOutcome)
	}

	skipped, err := taskModel(vikunja.Task{
		ID: 10, ProjectID: 7, Done: true,
		Labels: []vikunja.Label{
			{ID: 1, Title: "vbu:recurrence-history"},
			{ID: 2, Title: "vbu:skipped"},
		},
	}, projects, "UTC", time.Now(), 7)
	if err != nil {
		t.Fatalf("taskModel(skipped) error = %v", err)
	}
	if skipped.CompletionOutcome == nil || *skipped.CompletionOutcome != model.CompletionOutcomeSkipped {
		t.Fatalf("skipped outcome = %#v", skipped.CompletionOutcome)
	}

	active, err := taskModel(vikunja.Task{ID: 11, ProjectID: 7}, projects, "UTC", time.Now(), 7)
	if err != nil {
		t.Fatalf("taskModel(active) error = %v", err)
	}
	if active.CompletionOutcome != nil {
		t.Fatalf("active outcome = %#v", active.CompletionOutcome)
	}
}

func TestTaskModelMapsDateOnlyTask(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	due := time.Date(2026, time.August, 11, 23, 59, 59, 0, time.UTC)
	result, err := taskModel(vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Pay bill", DueDate: due, Priority: 4,
		Labels: []vikunja.Label{{ID: 2, Title: "vbu:date-only"}},
	}, map[int64]vikunja.Project{7: {ID: 7, Title: "Home"}}, "UTC", now, 7)
	if err != nil {
		t.Fatalf("taskModel() error = %v", err)
	}
	if result.Kind != model.TaskKindOneTime || result.HasDueTime || !result.IsOverdue || result.Project.Title != "Home" {
		t.Fatalf("taskModel() = %#v", result)
	}
	if result.Priority != model.TaskPriorityUrgent {
		t.Fatalf("taskModel() priority = %q, want %q", result.Priority, model.TaskPriorityUrgent)
	}
}

func TestPriorityModelMapsEveryVikunjaValue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		value int64
		want  model.TaskPriority
	}{
		{value: 0, want: model.TaskPriorityUnset},
		{value: 1, want: model.TaskPriorityLow},
		{value: 2, want: model.TaskPriorityMedium},
		{value: 3, want: model.TaskPriorityHigh},
		{value: 4, want: model.TaskPriorityUrgent},
		{value: 5, want: model.TaskPriorityDoNow},
	}
	for _, test := range tests {
		if got, err := priorityModel(test.value); err != nil || got != test.want {
			t.Fatalf("priorityModel(%d) = %q, %v; want %q", test.value, got, err, test.want)
		}
		if got, err := priorityValue(test.want); err != nil || got != test.value {
			t.Fatalf("priorityValue(%q) = %d, %v; want %d", test.want, got, err, test.value)
		}
	}
}

func TestPriorityModelRejectsUnsupportedVikunjaValue(t *testing.T) {
	t.Parallel()

	if _, err := priorityModel(6); err == nil {
		t.Fatal("priorityModel(6) error = nil")
	}
	if _, err := priorityValue(model.TaskPriority("INVALID")); err == nil {
		t.Fatal("priorityValue(INVALID) error = nil")
	}
}

func TestTaskModelMapsSupportedRecurrenceRule(t *testing.T) {
	t.Parallel()

	result, err := taskModel(vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Water",
		DueDate:     time.Date(2026, time.August, 16, 20, 0, 0, 0, time.UTC),
		RepeatAfter: 2 * 7 * 24 * 60 * 60, RepeatMode: 2,
		Labels: []vikunja.Label{{ID: 10, Title: "vbu:fixed-due-time"}},
	}, map[int64]vikunja.Project{7: {ID: 7, Title: "Home"}}, "UTC", time.Now(), 7)
	if err != nil {
		t.Fatalf("taskModel() error = %v", err)
	}
	if result.RecurrenceRule == nil || result.RecurrenceRule.Interval != 2 ||
		result.RecurrenceRule.Unit != model.RecurrenceUnitWeek ||
		result.RecurrenceRule.Mode != model.RecurrenceModeFromCompletion || !result.RecurrenceRule.KeepDueTime {
		t.Fatalf("taskModel() recurrence = %#v", result.RecurrenceRule)
	}
}

func TestTaskModelRejectsMissingProjectAndUnsupportedRecurrence(t *testing.T) {
	t.Parallel()

	if _, err := taskModel(vikunja.Task{ID: 9, ProjectID: 7}, nil, "UTC", time.Now(), 0); err == nil {
		t.Fatal("taskModel() missing-project error = nil")
	}
	if _, err := taskModel(
		vikunja.Task{ID: 9, ProjectID: 7, RepeatAfter: 60},
		map[int64]vikunja.Project{7: {ID: 7}}, "UTC", time.Now(), 0,
	); err == nil {
		t.Fatal("taskModel() unsupported-recurrence error = nil")
	}
}
