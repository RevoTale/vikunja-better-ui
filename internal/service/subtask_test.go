package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestSubtaskDefaultsCopyOnlyProjectPriorityAndOrdinaryLabels(t *testing.T) {
	t.Parallel()
	now := time.Now()
	parent := vikunja.Task{
		ID: 1, ProjectID: 7, Priority: 4, Title: "Parent", Description: "Private description",
		Done: true, DueDate: now, RepeatAfter: 86400,
		Labels: []vikunja.Label{{ID: 2, Title: "work"}, {ID: 3, Title: "vbu:job"}},
	}
	project, write, labels, err := subtaskWrite(parent, SubtaskInput{Title: "Child"})
	if err != nil || project != 7 || write.Title != "Child" || write.Priority != 4 {
		t.Fatalf("defaults: project=%d write=%+v err=%v", project, write, err)
	}
	if write.Done || write.Description != "" || write.DueDate != nil || write.RepeatAfter != 0 {
		t.Fatalf("inherited unrelated fields: %+v", write)
	}
	if len(labels) != 1 || labels[0] != 2 {
		t.Fatalf("inherited internal labels: %v", labels)
	}
}

func TestSubtaskOverridesCanClearPriorityAndLabels(t *testing.T) {
	t.Parallel()
	project, priority := int64(8), int64(0)
	parent := vikunja.Task{ProjectID: 7, Priority: 4, Labels: []vikunja.Label{{ID: 2, Title: "work"}}}
	id, write, labels, err := subtaskWrite(parent, SubtaskInput{
		Title: "Child", ProjectID: &project, Priority: &priority, LabelIDs: []int64{},
	})
	if err != nil || id != 8 || write.Priority != 0 || len(labels) != 0 {
		t.Fatalf("overrides: project=%d write=%+v labels=%v err=%v", id, write, labels, err)
	}
}
