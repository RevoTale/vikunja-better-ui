package resolver

import (
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func taskModel(
	task vikunja.Task,
	projects map[int64]vikunja.Project,
	timezone string,
	now time.Time,
	defaultProjectID int64,
) (*model.Task, error) {
	project, ok := projects[task.ProjectID]
	if !ok {
		return nil, fmt.Errorf("task references an inaccessible project")
	}
	priority, err := priorityModel(task.Priority)
	if err != nil {
		return nil, err
	}
	classification := service.ClassifyTask(task)
	recurrence, err := recurrenceRuleModel(task)
	if err != nil {
		return nil, err
	}
	labels := make([]*model.Label, 0, len(task.Labels))
	for _, label := range task.Labels {
		labels = append(labels, &model.Label{ID: strconv.FormatInt(label.ID, 10), Title: label.Title})
	}

	return &model.Task{
		ID: strconv.FormatInt(task.ID, 10), Title: task.Title, Description: task.Description,
		Kind: taskKindModel(classification.Kind), IsDone: task.Done, DoneAt: optionalTime(task.DoneAt),
		Project: &model.Project{
			ID: strconv.FormatInt(project.ID, 10), Title: project.Title,
			IsDefault: project.ID == defaultProjectID,
		},
		Priority: priority, DueAt: optionalTime(task.DueDate),
		HasDueTime: !task.DueDate.IsZero() && !classification.DateOnly,
		StartAt:    optionalTime(task.StartDate), EndAt: optionalTime(task.EndDate),
		RecurrenceRule: recurrence, Labels: labels,
		IsOverdue: !task.Done && !task.DueDate.IsZero() && task.DueDate.Before(now),
		Timezone:  timezone,
	}, nil
}

func recurrenceRuleModel(task vikunja.Task) (*model.RecurrenceRule, error) {
	if task.RepeatAfter == 0 && task.RepeatMode == 0 {
		return nil, nil
	}
	if task.RepeatMode == 1 {
		return &model.RecurrenceRule{
			Interval: 1, Unit: model.RecurrenceUnitMonth, Mode: model.RecurrenceModeScheduledCycle,
		}, nil
	}
	if task.RepeatAfter <= 0 || (task.RepeatMode != 0 && task.RepeatMode != 2) {
		return nil, fmt.Errorf("task recurrence fields are unsupported")
	}

	interval, unit, ok := intervalRule(task.RepeatAfter)
	if !ok || interval > math.MaxInt32 {
		return nil, fmt.Errorf("task recurrence interval is unsupported")
	}
	mode := model.RecurrenceModeScheduledCycle
	if task.RepeatMode == 2 {
		mode = model.RecurrenceModeFromCompletion
	}
	return &model.RecurrenceRule{Interval: int(interval), Unit: unit, Mode: mode}, nil
}

func intervalRule(seconds int64) (int64, model.RecurrenceUnit, bool) {
	const (
		daySeconds  = int64(24 * 60 * 60)
		weekSeconds = 7 * daySeconds
	)
	if seconds%weekSeconds == 0 {
		return seconds / weekSeconds, model.RecurrenceUnitWeek, true
	}
	if seconds%daySeconds == 0 {
		return seconds / daySeconds, model.RecurrenceUnitDay, true
	}
	return 0, "", false
}

func taskKindModel(kind service.TaskKind) model.TaskKind {
	switch kind {
	case service.TaskKindOneTime:
		return model.TaskKindOneTime
	case service.TaskKindRecurring:
		return model.TaskKindRecurring
	case service.TaskKindJob:
		return model.TaskKindJob
	case service.TaskKindInvalid:
		return model.TaskKindInvalid
	}
	return model.TaskKindInvalid
}

func optionalTime(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	copy := value
	return &copy
}
