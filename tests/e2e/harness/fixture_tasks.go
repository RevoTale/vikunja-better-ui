package main

import (
	"context"
	"strconv"
)

func (api *fixtureAPI) seedSchedule(ctx context.Context, demo bool) error {
	definitions, err := readSchedules()
	if err != nil {
		return err
	}
	if demo {
		if err = api.seedPreview(ctx); err != nil {
			return err
		}
	} else if err = api.seedHistory(ctx, definitions.Schedule); err != nil {
		return err
	}
	for _, spec := range append(definitions.Schedule, definitions.Week...) {
		if _, err = api.createTask(ctx, spec.active(api.clock), spec.Labels); err != nil {
			return err
		}
	}
	return nil
}

func (api *fixtureAPI) seedHistory(ctx context.Context, schedule []taskSpec) error {
	const historyCount = 125
	for index := range historyCount {
		spec := schedule[index%len(schedule)]
		labels := spec.HistoryLabels
		if labels == nil {
			labels = spec.Labels
		}
		task, err := api.createTask(ctx, spec.history(api.clock, -index/len(schedule)-1), labels)
		if err != nil {
			return err
		}
		if err = api.patch(ctx, task.ID, []fixturePatch{
			{Op: patchTestOperation, Path: patchDonePath, Value: false},
			{Op: patchReplaceOperation, Path: patchDonePath, Value: true},
		}, nil); err != nil {
			return err
		}
	}
	return nil
}

func (api *fixtureAPI) seedSpecialTasks(ctx context.Context, longProject int64) error {
	const labeledPriority, repeatFromCompletion = 3, 2
	if _, err := api.createTask(ctx, fixtureTask{
		Title: labeledFixtureTitle, DueDate: api.clock, Priority: labeledPriority,
	}, []string{"focus"}); err != nil {
		return err
	}
	if _, err := api.create(ctx, "/projects/"+strconv.FormatInt(longProject, 10)+"/tasks", fixtureTask{
		Title: "Long project badge fixture", DueDate: api.clock,
	}); err != nil {
		return err
	}
	_, err := api.createTask(ctx, fixtureTask{
		Title: invalidFixtureTitle, DueDate: api.clock, RepeatAfter: secondsPerDay, RepeatMode: repeatFromCompletion,
	}, []string{"vbu:recurrence-history"})
	return err
}
