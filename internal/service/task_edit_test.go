package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestEditTaskRejectsStaleAndHistory(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name    string
		done    bool
		history bool
		version string
		want    error
	}{
		{"stale", false, false, "old", vikunja.ErrConditionFailed},
		{"completed", true, false, "", ErrTaskNotActive},
		{"history", false, true, "", ErrTaskNotActive},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Read", Done: test.done}
			if test.history {
				before.Labels = []vikunja.Label{{ID: 9, Title: recurrenceHistoryLabel}}
			}
			client := &editClientStub{task: before}
			_, err := EditTask(t.Context(), client, EditTaskInput{TaskID: 1, ProjectID: 7, ExpectedVersion: test.version}, time.UTC, []int64{7})
			if !errors.Is(err, test.want) || client.writes != 0 {
				t.Fatalf("err = %v, writes = %d", err, client.writes)
			}
		})
	}
}

func TestEditTaskPreservesOtherLabelsAndClearsFields(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Before", Description: "Old", Priority: 3,
		Labels: []vikunja.Label{{ID: 10, Title: "reading"}}}
	client := &editClientStub{task: before}
	result, err := EditTask(t.Context(), client, EditTaskInput{TaskID: 1, ProjectID: 8, Title: "After", ExpectedVersion: TaskVersion(before)}, time.UTC, []int64{7, 8})
	if err != nil {
		t.Fatal(err)
	}
	if result.Title != "After" || result.Description != "" || result.Priority != 0 || result.ProjectID != 8 || len(result.Labels) != 1 {
		t.Fatalf("result = %#v", result)
	}
}

func TestBuildEditedRecurringJob(t *testing.T) {
	t.Parallel()
	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	input := EditTaskInput{Title: "Shift", Job: true, StartLocal: "2026-09-08T08:00", EndLocal: "2026-09-08T12:00", DueDate: "2026-09-08", DueTime: "13:00",
		Recurrence: &RecurringInput{Interval: 2, Unit: RecurrenceUnitDay, Mode: RecurrenceModeFromCompletion, KeepDueTime: true}}
	write, markers, err := BuildEditedTask(input, location)
	if err != nil {
		t.Fatal(err)
	}
	if write.EndDate.Sub(*write.StartDate) != 4*time.Hour || write.RepeatAfter != 172800 || !markers[fixedDueTimeLabel] || !markers[jobLabel] {
		t.Fatalf("write = %#v, markers = %#v", write, markers)
	}
	input.DueTime = "11:00"
	if _, _, err := BuildEditedTask(input, location); !errors.Is(err, ErrInvalidEdit) {
		t.Fatalf("invalid ordering: %v", err)
	}
	input.DueTime = "13:00"
	input.Recurrence.Mode = RecurrenceModeScheduled
	if _, _, err := BuildEditedTask(input, location); !errors.Is(err, ErrInvalidEdit) {
		t.Fatalf("invalid fixed time: %v", err)
	}
}

type editClientStub struct {
	recurrenceSettingClientStub
	task              vikunja.Task
	writes            int
	ignoreDescription bool
}

func TestEditTaskPreservesUnchangedSeconds(t *testing.T) {
	t.Parallel()
	due := time.Date(2026, time.September, 8, 12, 30, 56, 0, time.UTC)
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Before", DueDate: due}
	client := &editClientStub{task: before}
	result, err := EditTask(t.Context(), client, EditTaskInput{
		TaskID: 1, ProjectID: 7, Title: "After", ExpectedVersion: TaskVersion(before), DueDate: "2026-09-08", DueTime: "12:30",
	}, time.UTC, []int64{7})
	if err != nil || !result.DueDate.Equal(due) {
		t.Fatalf("result = %#v, error = %v", result, err)
	}
}

func TestEditTaskRejectsInaccessibleDestinationBeforeWrite(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Before"}
	client := &editClientStub{task: before}
	_, err := EditTask(t.Context(), client, EditTaskInput{
		TaskID: 1, ProjectID: 8, Title: "After", ExpectedVersion: TaskVersion(before),
	}, time.UTC, []int64{7})
	if !errors.Is(err, ErrTaskNotAccessible) || client.writes != 0 {
		t.Fatalf("error = %v, writes = %d", err, client.writes)
	}
}

func TestEditTaskReportsUnconfirmedMarkerAsPartial(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Before", Labels: []vikunja.Label{{ID: 10, Title: dateOnlyLabel}}}
	client := &editClientStub{task: before}
	_, err := EditTask(t.Context(), client, EditTaskInput{
		TaskID: 1, ProjectID: 7, Title: "After", ExpectedVersion: TaskVersion(before),
	}, time.UTC, []int64{7})
	// Stub accepts the detach but leaves the label in upstream state.
	if !errors.Is(err, ErrEditPartial) || client.task.Title != "After" {
		t.Fatalf("error = %v, task = %#v", err, client.task)
	}
}

func TestEditTaskReportsUnconfirmedDescriptionAsPartial(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Before", Description: "Old"}
	client := &editClientStub{task: before, ignoreDescription: true}
	_, err := EditTask(t.Context(), client, EditTaskInput{
		TaskID: 1, ProjectID: 7, Title: "After", Description: "New", ExpectedVersion: TaskVersion(before),
	}, time.UTC, []int64{7})
	if !errors.Is(err, ErrEditPartial) || client.task.Title != "After" {
		t.Fatalf("error = %v, task = %#v", err, client.task)
	}
}

func (client *editClientStub) Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	return client.task, vikunja.ResponseMetadata{}, nil
}

func (client *editClientStub) PatchTaskChecked(_ context.Context, _ int64, patch vikunja.TaskPatch, check vikunja.TaskCheck) (vikunja.Task, error) {
	if check.Title == nil || *check.Title != client.task.Title || check.Done == nil || *check.Done != client.task.Done {
		return vikunja.Task{}, vikunja.ErrConditionFailed
	}
	client.writes++
	client.task.Title = *patch.Title
	if !client.ignoreDescription {
		client.task.Description = *patch.Description
	}
	client.task.ProjectID, client.task.Priority = *patch.ProjectID, *patch.Priority
	client.task.DueDate, client.task.StartDate, client.task.EndDate = *patch.DueDate, *patch.StartDate, *patch.EndDate
	client.task.RepeatAfter, client.task.RepeatMode = *patch.RepeatAfter, *patch.RepeatMode
	return client.task, nil
}
