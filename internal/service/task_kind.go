package service

import "github.com/RevoTale/vikunja-better-ui/internal/vikunja"

const (
	jobLabel               = "job"
	dateOnlyLabel          = "vbu:date-only"
	recurrenceHistoryLabel = "vbu:recurrence-history"
)

type TaskKind string

const (
	TaskKindOneTime   TaskKind = "ONE_TIME"
	TaskKindRecurring TaskKind = "RECURRING"
	TaskKindJob       TaskKind = "JOB"
	TaskKindInvalid   TaskKind = "INVALID"
)

type TaskClassification struct {
	Kind     TaskKind
	DateOnly bool
}

func ClassifyTask(task vikunja.Task) TaskClassification {
	hasJob := hasLabel(task.Labels, jobLabel)
	hasDateOnly := hasLabel(task.Labels, dateOnlyLabel)
	hasHistory := hasLabel(task.Labels, recurrenceHistoryLabel)
	hasRecurrence := task.RepeatAfter > 0 || task.RepeatMode != 0

	kind := TaskKindOneTime
	switch {
	case hasHistory && (hasRecurrence || hasJob || !task.Done):
		kind = TaskKindInvalid
	case hasRecurrence && hasJob:
		kind = TaskKindInvalid
	case hasHistory || hasRecurrence:
		kind = TaskKindRecurring
	case hasJob:
		kind = TaskKindJob
	}

	return TaskClassification{Kind: kind, DateOnly: hasDateOnly}
}

func hasLabel(labels []vikunja.Label, title string) bool {
	for _, label := range labels {
		if label.Title == title {
			return true
		}
	}
	return false
}
