package service

import (
	"context"
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestDeleteActiveTaskDeletesSupportedAndInvalidActiveTasks(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		task vikunja.Task
	}{
		{name: "one time", task: vikunja.Task{ID: 1, ProjectID: 7}},
		{name: "job", task: vikunja.Task{ID: 2, ProjectID: 7, Labels: []vikunja.Label{{ID: 1, Title: jobLabel}}}},
		{name: "recurring", task: vikunja.Task{ID: 3, ProjectID: 7, RepeatAfter: 86400}},
		{
			name: "invalid recurring job",
			task: vikunja.Task{
				ID: 4, ProjectID: 7, RepeatAfter: 86400,
				Labels: []vikunja.Label{{ID: 1, Title: jobLabel}},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			client := &deletionClientStub{task: test.task}
			if err := DeleteActiveTask(context.Background(), client, test.task.ID, []int64{7}); err != nil {
				t.Fatalf("DeleteActiveTask() error = %v", err)
			}
			if client.deletedTaskID != test.task.ID {
				t.Fatalf("deleted task ID = %d", client.deletedTaskID)
			}
		})
	}
}

func TestDeleteActiveTaskRejectsCompletedAndHistoryOwnedTasks(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		task vikunja.Task
	}{
		{name: "completed", task: vikunja.Task{ID: 1, ProjectID: 7, Done: true}},
		{
			name: "recurrence history",
			task: vikunja.Task{ID: 2, ProjectID: 7, Labels: []vikunja.Label{{ID: 1, Title: recurrenceHistoryLabel}}},
		},
		{
			name: "skipped marker",
			task: vikunja.Task{ID: 3, ProjectID: 7, Labels: []vikunja.Label{{ID: 1, Title: skippedLabel}}},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			client := &deletionClientStub{task: test.task}
			err := DeleteActiveTask(context.Background(), client, test.task.ID, []int64{7})
			if !errors.Is(err, ErrTaskNotActive) {
				t.Fatalf("DeleteActiveTask() error = %v", err)
			}
			if client.deletedTaskID != 0 {
				t.Fatalf("deleted task ID = %d", client.deletedTaskID)
			}
		})
	}
}

func TestDeleteActiveTaskRejectsInaccessibleProject(t *testing.T) {
	t.Parallel()

	client := &deletionClientStub{task: vikunja.Task{ID: 9, ProjectID: 8}}
	err := DeleteActiveTask(context.Background(), client, 9, []int64{7})
	if !errors.Is(err, ErrTaskNotAccessible) || client.deletedTaskID != 0 {
		t.Fatalf("DeleteActiveTask() error = %v, deleted task ID = %d", err, client.deletedTaskID)
	}
}

type deletionClientStub struct {
	task          vikunja.Task
	readErr       error
	deleteErr     error
	deletedTaskID int64
}

func (client *deletionClientStub) Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	return client.task, vikunja.ResponseMetadata{}, client.readErr
}

func (client *deletionClientStub) DeleteTask(_ context.Context, taskID int64) error {
	client.deletedTaskID = taskID
	return client.deleteErr
}
