package service

import (
	"context"
	"errors"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func normalizeRenewedDue(
	ctx context.Context,
	client recurringCompletionClient,
	task vikunja.Task,
	etag string,
	target time.Time,
) (vikunja.Task, error) {
	if task.DueDate.Equal(target) {
		return task, nil
	}
	if etag == "" {
		return vikunja.Task{}, errors.New("renewed task has no ETag")
	}
	if _, err := client.PatchTaskChecked(ctx, task.ID, vikunja.TaskPatch{DueDate: &target}, vikunja.TaskCheck{
		Done: new(false), DueDate: &task.DueDate,
		RepeatAfter: &task.RepeatAfter, RepeatMode: &task.RepeatMode,
	}); err != nil {
		return vikunja.Task{}, taskPatchError(err)
	}
	confirmed, _, err := client.Task(ctx, task.ID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if !confirmed.DueDate.Equal(target) || ClassifyTask(confirmed).Kind != TaskKindRecurring {
		return vikunja.Task{}, errors.New("fixed due time normalization was not confirmed")
	}
	return confirmed, nil
}

func normalizeRenewedJobSchedule(
	ctx context.Context,
	client recurringCompletionClient,
	task vikunja.Task,
	etag string,
	target jobSchedule,
) (vikunja.Task, error) {
	if jobScheduleMatches(task, target) {
		return task, nil
	}
	if etag == "" {
		return vikunja.Task{}, errors.New("renewed task has no ETag")
	}
	if _, err := client.PatchTaskChecked(ctx, task.ID, vikunja.TaskPatch{
		StartDate: &target.StartAt, EndDate: &target.EndAt, DueDate: &target.DueAt,
	}, vikunja.TaskCheck{
		Done: new(false), StartDate: &task.StartDate, EndDate: &task.EndDate, DueDate: &task.DueDate,
		RepeatAfter: &task.RepeatAfter, RepeatMode: &task.RepeatMode,
	}); err != nil {
		return vikunja.Task{}, taskPatchError(err)
	}
	confirmed, _, err := client.Task(ctx, task.ID)
	if err != nil {
		return vikunja.Task{}, err
	}
	classification := ClassifyTask(confirmed)
	if !jobScheduleMatches(confirmed, target) ||
		classification.Kind != TaskKindJob || !classification.Recurring {
		return vikunja.Task{}, errors.New("recurring job schedule normalization was not confirmed")
	}
	return confirmed, nil
}

func jobScheduleMatches(task vikunja.Task, target jobSchedule) bool {
	return task.StartDate.Equal(target.StartAt) && task.EndDate.Equal(target.EndAt) &&
		task.DueDate.Equal(target.DueAt)
}

func verifyRenewal(before vikunja.Task, renewed vikunja.Task) error {
	if renewed.ID != before.ID || renewed.Done || renewed.DoneAt.IsZero() || renewed.DueDate.IsZero() ||
		!ClassifyTask(renewed).Recurring {
		return errors.New("recurring renewal could not be confirmed")
	}
	switch before.RepeatMode {
	case 0:
		return verifyScheduledRenewal(before, renewed)
	case 1:
		if !renewed.DueDate.After(before.DueDate) {
			return errors.New("recurring due date did not advance")
		}
		expected := time.Date(
			before.DueDate.Year(), before.DueDate.Month()+1, before.DueDate.Day(),
			before.DueDate.Hour(), before.DueDate.Minute(), before.DueDate.Second(), before.DueDate.Nanosecond(),
			before.DueDate.Location(),
		)
		if !renewed.DueDate.Equal(expected) {
			return errors.New("monthly recurrence advanced unexpectedly")
		}
	case vikunja.RepeatModeFromCompletion:
		expected := renewed.DoneAt.Add(time.Duration(before.RepeatAfter) * time.Second)
		if absoluteDuration(renewed.DueDate.Sub(expected)) > 2*time.Second {
			return errors.New("from-completion recurrence advanced unexpectedly")
		}
	default:
		return errors.New("recurrence mode is unsupported")
	}
	return nil
}

func verifyScheduledRenewal(before, renewed vikunja.Task) error {
	if !renewed.DueDate.After(before.DueDate) {
		return errors.New("recurring due date did not advance")
	}
	step := time.Duration(before.RepeatAfter) * time.Second
	if step <= 0 {
		return errors.New("scheduled recurrence interval is invalid")
	}
	expected, err := advanceAfter(before.DueDate.Add(step), renewed.DoneAt, step)
	if err != nil {
		return err
	}
	if !renewed.DueDate.Equal(expected) {
		return errors.New("scheduled recurrence advanced unexpectedly")
	}
	return nil
}

func normalizeRenewedDateOnly(
	ctx context.Context,
	client recurringCompletionClient,
	task vikunja.Task,
	etag string,
	location *time.Location,
) (vikunja.Task, error) {
	if !ClassifyTask(task).DateOnly {
		return task, nil
	}
	localDue := task.DueDate.In(location)
	normalized := time.Date(localDue.Year(), localDue.Month(), localDue.Day(), 23, 59, 59, 0, location)
	if task.DueDate.Equal(normalized) {
		return task, nil
	}
	if etag == "" {
		return vikunja.Task{}, errors.New("renewed task has no ETag")
	}
	if _, err := client.PatchTaskChecked(ctx, task.ID, vikunja.TaskPatch{DueDate: &normalized}, vikunja.TaskCheck{
		Done: new(false), DueDate: &task.DueDate,
	}); err != nil {
		return vikunja.Task{}, taskPatchError(err)
	}
	confirmed, _, err := client.Task(ctx, task.ID)
	if err != nil {
		return vikunja.Task{}, err
	}
	if !confirmed.DueDate.Equal(normalized) || !ClassifyTask(confirmed).DateOnly {
		return vikunja.Task{}, errors.New("date-only renewal normalization was not confirmed")
	}
	return confirmed, nil
}

func absoluteDuration(value time.Duration) time.Duration {
	if value < 0 {
		return -value
	}
	return value
}
