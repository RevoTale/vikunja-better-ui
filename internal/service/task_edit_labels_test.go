package service

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestEditLabelsClearsOnlyOrdinaryLabels(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Task", Labels: []vikunja.Label{{ID: 3, Title: "vbu:future"}, {ID: 4, Title: "work"}}}
	client := &labelEditStub{}
	client.task = before
	result, err := EditTask(t.Context(), client, EditTaskInput{TaskID: 1, ProjectID: 7, Title: "Task", ExpectedVersion: TaskVersion(before), LabelIDs: []int64{}}, time.UTC, []int64{7})
	if err != nil || len(result.Labels) != 1 || result.Labels[0].ID != 3 {
		t.Fatalf("result=%#v err=%v", result, err)
	}
}

func TestEditLabelsFailureRequiresReload(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Task", Labels: []vikunja.Label{{ID: 4, Title: "work"}}}
	client := &labelEditStub{detachErr: errors.New("unavailable")}
	client.task = before
	_, err := EditTask(t.Context(), client, EditTaskInput{TaskID: 1, ProjectID: 7, Title: "Updated", ExpectedVersion: TaskVersion(before), LabelIDs: []int64{}}, time.UTC, []int64{7})
	if !errors.Is(err, ErrEditPartial) || client.writes != 1 || client.task.Title != "Updated" {
		t.Fatalf("err=%v task=%#v", err, client.task)
	}
}

func TestEditLabelsRejectsReservedBeforeTaskWrite(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Task"}
	client := &labelEditStub{}
	client.task = before
	client.labels = []vikunja.Label{{ID: 4, Title: "vbu:job"}}
	_, err := EditTask(t.Context(), client, EditTaskInput{TaskID: 1, ProjectID: 7, Title: "Updated", ExpectedVersion: TaskVersion(before), LabelIDs: []int64{4}}, time.UTC, []int64{7})
	if !errors.Is(err, ErrInvalidLabels) || client.writes != 0 {
		t.Fatalf("err=%v writes=%d", err, client.writes)
	}
}

type labelEditStub struct {
	editClientStub
	detachErr error
}

func (client *labelEditStub) DetachLabel(_ context.Context, _ int64, id int64) error {
	if client.detachErr != nil {
		return client.detachErr
	}
	client.task.Labels = slices.DeleteFunc(client.task.Labels, func(label vikunja.Label) bool { return label.ID == id })
	return nil
}
