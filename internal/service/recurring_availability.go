package service

import (
	"context"
	"errors"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func recurringAvailabilityDays(task vikunja.Task, location *time.Location) (int, error) {
	if location == nil || task.StartDate.IsZero() || task.DueDate.IsZero() || !task.EndDate.IsZero() ||
		ClassifyTask(task).Kind != TaskKindRecurring {
		return 0, errors.New("recurring availability schedule is invalid")
	}
	start, due := task.StartDate.In(location), task.DueDate.In(location)
	startDay := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	dueDay := time.Date(due.Year(), due.Month(), due.Day(), 0, 0, 0, 0, time.UTC)
	days := (dueDay.Unix() - startDay.Unix()) / recurrenceDaySeconds
	if days < 0 {
		return 0, errors.New("recurring availability starts after its due date")
	}
	return int(days), nil
}

func normalizeRecurringAvailability(
	ctx context.Context, client recurringCompletionClient, before, renewed vikunja.Task, etag string,
	fixedTarget time.Time, location *time.Location, grant RecurringRepairGrant,
) (vikunja.Task, RecurringRepairGrant, error) {
	grant.TargetDueAt = time.Time{}
	days, err := recurringAvailabilityDays(before, location)
	if err != nil {
		return renewed, grant, err
	}
	due := renewed.DueDate
	if !fixedTarget.IsZero() {
		due = fixedTarget
	}
	localDue := due.In(location)
	if ClassifyTask(before).DateOnly {
		due, err = ResolveDateOnly(localDue.Format(localDateLayout), location)
		if err != nil {
			return renewed, grant, err
		}
	}
	startDay := time.Date(localDue.Year(), localDue.Month(), localDue.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -days)
	if startDay.Year() < 1 || startDay.Year() > 9999 {
		return renewed, grant, errors.New("recurring availability is outside the supported range")
	}
	start, err := renewedAvailabilityStart(startDay, before, location)
	if err != nil {
		return renewed, grant, err
	}
	if start.After(due) {
		return renewed, grant, errors.New("renewed availability starts after its due date")
	}
	target := jobSchedule{StartAt: start, DueAt: due}
	grant.TargetStartAt, grant.TargetEndAt, grant.TargetDueAt = target.StartAt, target.EndAt, target.DueAt
	normalized, err := normalizeRenewedAvailability(ctx, client, renewed, etag, target)
	return normalized, grant, err
}

// firstAvailableLocalDay finds the earliest instant on the requested civil day,
// or on the next existing day when a timezone transition skips the whole day.
func firstAvailableLocalDay(day time.Time, location *time.Location) (time.Time, error) {
	const searchHours = 72
	from, until := day.Add(-searchHours*time.Hour), day.Add(searchHours*time.Hour)
	for cursor := from; cursor.Before(until); {
		local := cursor.In(location)
		_, offset := local.Zone()
		_, end := local.ZoneBounds()
		candidate := day.Add(-time.Duration(offset) * time.Second)
		if candidate.Before(cursor) {
			candidate = cursor
		}
		if (end.IsZero() || candidate.Before(end)) && candidate.Before(until) {
			localCandidate := candidate.In(location)
			if localCandidate.Year() >= 1 && localCandidate.Year() <= 9999 &&
				localCandidate.Format(localDateLayout) >= day.Format(localDateLayout) {
				return candidate, nil
			}
		}
		if end.IsZero() || !end.After(cursor) {
			break
		}
		cursor = end
	}
	return time.Time{}, errors.New("recurring availability day cannot be resolved")
}

func normalizeRenewedAvailability(
	ctx context.Context, client recurringCompletionClient, task vikunja.Task, etag string, target jobSchedule,
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
	if !jobScheduleMatches(confirmed, target) || ClassifyTask(confirmed).Kind != TaskKindRecurring ||
		!hasLabel(confirmed.Labels, recurringAvailabilityLabel) {
		return vikunja.Task{}, errors.New("recurring availability normalization was not confirmed")
	}
	return confirmed, nil
}

func resolveRecurringStart(day, clock string, location *time.Location) (time.Time, error) {
	if clock == "" {
		return resolveAvailabilityDay(day, location)
	}
	return ResolveLocalDateTime(day+"T"+clock, location)
}

func renewedAvailabilityStart(day time.Time, before vikunja.Task, location *time.Location) (time.Time, error) {
	startDay, err := firstAvailableLocalDay(day, location)
	if err != nil {
		return time.Time{}, err
	}
	oldDay, err := resolveAvailabilityDay(before.StartDate.In(location).Format(localDateLayout), location)
	if err != nil || oldDay.Equal(before.StartDate) {
		return startDay, err
	}
	// Exact local availability remains exact across renewal, including DST.
	clock := before.StartDate.In(location).Format("15:04:05")
	return resolveLocalWallTime(startDay.In(location).Format(localDateLayout)+"T"+clock, localDateSecondLayout, location)
}
