package resolver

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

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
}

func TestTaskModelMapsSupportedRecurrenceRule(t *testing.T) {
	t.Parallel()

	result, err := taskModel(vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Water", RepeatAfter: 2 * 7 * 24 * 60 * 60, RepeatMode: 2,
	}, map[int64]vikunja.Project{7: {ID: 7, Title: "Home"}}, "UTC", time.Now(), 7)
	if err != nil {
		t.Fatalf("taskModel() error = %v", err)
	}
	if result.RecurrenceRule == nil || result.RecurrenceRule.Interval != 2 ||
		result.RecurrenceRule.Unit != model.RecurrenceUnitWeek || result.RecurrenceRule.Mode != model.RecurrenceModeFromCompletion {
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
