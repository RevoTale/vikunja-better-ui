package service

import "github.com/RevoTale/vikunja-better-ui/internal/vikunja"

const (
	jobLabel               = "job"
	dateOnlyLabel          = "vbu:date-only"
	recurrenceHistoryLabel = "vbu:recurrence-history"
	skippedLabel           = "vbu:skipped"
	fixedDueTimeLabel      = "vbu:fixed-due-time"
)

type TaskKind string

const (
	TaskKindOneTime   TaskKind = "ONE_TIME"
	TaskKindRecurring TaskKind = "RECURRING"
	TaskKindJob       TaskKind = "JOB"
	TaskKindInvalid   TaskKind = "INVALID"
)

type TaskClassification struct {
	Kind         TaskKind
	DateOnly     bool
	FixedDueTime bool
	Outcome      CompletionOutcome
}

type CompletionOutcome string

const (
	CompletionOutcomeCompleted CompletionOutcome = "COMPLETED"
	CompletionOutcomeSkipped   CompletionOutcome = "SKIPPED"
)

func ClassifyTask(task vikunja.Task) TaskClassification {
	hasJob := hasLabel(task.Labels, jobLabel)
	hasDateOnly := hasLabel(task.Labels, dateOnlyLabel)
	hasHistory := hasLabel(task.Labels, recurrenceHistoryLabel)
	hasSkipped := hasLabel(task.Labels, skippedLabel)
	hasFixedDueTime := hasLabel(task.Labels, fixedDueTimeLabel)
	hasRecurrence := task.RepeatAfter > 0 || task.RepeatMode != 0
	validHistory := hasHistory && task.Done && !hasRecurrence && !hasJob
	validSkipped := hasSkipped && validHistory
	validFixedDueTime := hasFixedDueTime && fixedDueTimeEligible(task)

	kind := TaskKindOneTime
	switch {
	case hasSkipped && !validSkipped:
		kind = TaskKindInvalid
	case hasHistory && (hasRecurrence || hasJob || !task.Done):
		kind = TaskKindInvalid
	case hasRecurrence && hasJob:
		kind = TaskKindInvalid
	case hasHistory || hasRecurrence:
		kind = TaskKindRecurring
	case hasJob:
		kind = TaskKindJob
	}
	if hasFixedDueTime && !validFixedDueTime {
		kind = TaskKindInvalid
	}

	var outcome CompletionOutcome
	if task.Done && kind != TaskKindInvalid {
		outcome = CompletionOutcomeCompleted
		if validSkipped {
			outcome = CompletionOutcomeSkipped
		}
	}

	return TaskClassification{
		Kind: kind, DateOnly: hasDateOnly, FixedDueTime: hasFixedDueTime, Outcome: outcome,
	}
}

func fixedDueTimeEligible(task vikunja.Task) bool {
	return !task.Done && !task.DueDate.IsZero() && task.RepeatAfter > 0 &&
		task.RepeatAfter%recurrenceDaySeconds == 0 && task.RepeatMode == 2 &&
		!hasLabel(task.Labels, dateOnlyLabel) && !hasLabel(task.Labels, recurrenceHistoryLabel) &&
		!hasLabel(task.Labels, skippedLabel) && !hasLabel(task.Labels, jobLabel)
}

func hasLabel(labels []vikunja.Label, title string) bool {
	for _, label := range labels {
		if label.Title == title {
			return true
		}
	}
	return false
}
