package service

import (
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestPlanningEditPreservesDeadlineAndUnchangedPrecision(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Website",
		DueDate: time.Date(2026, time.December, 5, 12, 30, 45, 0, time.UTC)}
	client := &editClientStub{task: before}
	input := EditTaskInput{TaskID: 1, ProjectID: 7, Title: before.Title, ExpectedVersion: TaskVersion(before),
		DueDate: "2026-12-05", DueTime: "12:30",
		Planning: &PlanningWindowInput{StartsOn: "2026-11-01", EndsOn: "2026-11-30"}}
	result, err := EditTask(t.Context(), client, input, time.UTC, []int64{7})
	if err != nil || !result.DueDate.Equal(before.DueDate) || result.EndDate.Second() != 59 {
		t.Fatalf("planned edit = %#v, error = %v", result, err)
	}
	input.Planning = nil
	input.StartLocal, input.EndLocal = "2026-11-01T00:00", "2026-11-30T23:59"
	input.ExpectedVersion = TaskVersion(result)
	input.Title = "Renamed website"
	result, err = EditTask(t.Context(), client, input, time.UTC, []int64{7})
	if err != nil || result.EndDate.Second() != 59 {
		t.Fatalf("unrelated edit changed the window: %#v, %v", result, err)
	}
	input.StartLocal, input.EndLocal = "", ""
	input.ExpectedVersion = TaskVersion(result)
	result, err = EditTask(t.Context(), client, input, time.UTC, []int64{7})
	if err != nil || !result.StartDate.IsZero() || !result.EndDate.IsZero() || !result.DueDate.Equal(before.DueDate) {
		t.Fatalf("clear changed deadline or kept window: %#v, %v", result, err)
	}
}

func TestEditPreservesExactScheduleWithinOneMinute(t *testing.T) {
	t.Parallel()
	minute := time.Date(2026, time.November, 5, 10, 0, 0, 0, time.UTC)
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Imported",
		StartDate: minute.Add(5 * time.Second), EndDate: minute.Add(45 * time.Second)}
	input := EditTaskInput{TaskID: before.ID, ProjectID: before.ProjectID,
		ExpectedVersion: TaskVersion(before), Title: "Renamed", StartLocal: "2026-11-05T10:00",
		EndLocal: "2026-11-05T10:00", DueDate: "2026-11-06", DueTime: "12:30"}
	got, err := EditTask(t.Context(), &editClientStub{task: before}, input, time.UTC, []int64{before.ProjectID})
	if err != nil || !got.StartDate.Equal(before.StartDate) || !got.EndDate.Equal(before.EndDate) {
		t.Fatalf("edited schedule = %v to %v, error = %v", got.StartDate, got.EndDate, err)
	}
}

func TestPlanningEditRejectsDeadlineConflictBeforeWrite(t *testing.T) {
	t.Parallel()
	before := vikunja.Task{ID: 1, ProjectID: 7, Title: "Website",
		StartDate: time.Date(2026, time.November, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2026, time.November, 30, 23, 59, 59, 0, time.UTC)}
	client := &editClientStub{task: before}
	_, err := EditTask(t.Context(), client, EditTaskInput{
		TaskID: 1, ProjectID: 7, Title: before.Title, ExpectedVersion: TaskVersion(before),
		StartLocal: "2026-11-01T00:00", EndLocal: "2026-11-30T23:59", DueDate: "2026-11-20", DueTime: "12:00",
	}, time.UTC, []int64{7})
	if !errors.Is(err, ErrInvalidEdit) || client.writes != 0 {
		t.Fatalf("conflicting edit was written: writes=%d, err=%v", client.writes, err)
	}
}
