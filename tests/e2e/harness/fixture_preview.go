package main

import (
	"context"
	"errors"
	"fmt"
	"time"
)

func previewActivityTasks(now time.Time, seed uint32) []fixtureTask {
	const (
		multiplier             uint32 = 1664525
		increment              uint32 = 1013904223
		randomRange                   = 4294967296.0
		lastDay                       = 20
		minimumTasks                  = 3
		taskVariation                 = 8
		minimumOnTime                 = 0.2
		onTimeVariation               = 0.75
		completionMinutes             = 180
		noDeadlineChance              = 0.12
		minimumDeadlineMinutes        = 15
		deadlineVariation             = 240
		priorities                    = 6
	)
	random := func() float64 { seed = seed*multiplier + increment; return float64(seed) / randomRange }
	var tasks []fixtureTask
	for offset := lastDay; offset >= 0; offset-- {
		count := minimumTasks + int(random()*taskVariation)
		onTimeChance := minimumOnTime + random()*onTimeVariation
		for index := range count {
			done := time.Date(now.Year(), now.Month(), now.Day()-offset, 12, int(random()*completionMinutes), 0, 0, time.UTC)
			if offset == 0 {
				done = now
			}
			hasDeadline := random() > noDeadlineChance
			delta := time.Duration(minimumDeadlineMinutes+int(random()*deadlineVariation)) * time.Minute
			if random() >= onTimeChance {
				delta = -delta
			}
			task := fixtureTask{Title: fmt.Sprintf("Preview activity %dd / %d", offset, index+1),
				Priority: int(random() * priorities), Done: true, DoneAt: done.UTC()}
			if hasDeadline {
				task.DueDate = done.Add(delta).UTC()
			}
			tasks = append(tasks, task)
		}
	}
	return tasks
}

func (api *fixtureAPI) seedPreview(ctx context.Context) error {
	//nolint:gosec // Wrapping the millisecond clock to 32 bits intentionally matches the preview PRNG seed.
	seed := uint32(api.clock.UnixMilli())
	for _, task := range previewActivityTasks(api.clock, seed) {
		created, err := api.createTask(ctx, task, nil)
		if err != nil {
			return err
		}
		if err = api.restorePreviewDate(ctx, created, task.DoneAt); err != nil {
			return err
		}
	}
	return nil
}

func (api *fixtureAPI) restorePreviewDate(ctx context.Context, created fixtureEntity, want time.Time) error {
	// Some Vikunja versions preserve done_at during creation; avoid a no-op PATCH
	// which returns 304 rather than a task response.
	if created.DoneAt.UnixMilli() == want.UnixMilli() {
		return nil
	}
	var updated fixtureEntity
	if err := api.patch(ctx, created.ID, []fixturePatch{
		{Op: patchTestOperation, Path: patchDonePath, Value: true},
		{Op: patchReplaceOperation, Path: "/done_at", Value: want},
	}, &updated); err != nil {
		return err
	}
	if updated.DoneAt.UnixMilli() != want.UnixMilli() {
		return errors.New("vikunja did not preserve the preview completion date")
	}
	return nil
}
