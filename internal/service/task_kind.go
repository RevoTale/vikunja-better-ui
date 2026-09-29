package service

import "github.com/RevoTale/vikunja-better-ui/internal/vikunja"

const (
	jobLabel               = "vbu:job"
	dateOnlyLabel          = "vbu:date-only"
	recurrenceHistoryLabel = "vbu:recurrence-history"
	skippedLabel           = "vbu:skipped"
	fixedDueTimeLabel      = "vbu:fixed-due-time"
)

// TaskKind describes the supported workflow, independently of active recurrence.
type TaskKind string

// Supported task workflows; invalid marks contradictory internal metadata.
const (
	TaskKindOneTime   TaskKind = "ONE_TIME"
	TaskKindRecurring TaskKind = "RECURRING"
	TaskKindJob       TaskKind = "JOB"
	TaskKindInvalid   TaskKind = "INVALID"
)

// TaskClassification interprets Better UI markers without modifying upstream data.
type TaskClassification struct {
	Kind         TaskKind
	DateOnly     bool
	FixedDueTime bool
	Recurring    bool
	Outcome      CompletionOutcome
}

// CompletionOutcome distinguishes completed work from a skipped occurrence.
type CompletionOutcome string

// Recorded outcomes for completed tasks and recurrence snapshots.
const (
	CompletionOutcomeCompleted CompletionOutcome = "COMPLETED"
	CompletionOutcomeSkipped   CompletionOutcome = "SKIPPED"
)

// ClassifyTask rejects contradictory markers and keeps Job orthogonal to recurrence.
func ClassifyTask(task vikunja.Task) TaskClassification {
	hasDateOnly := hasLabel(task.Labels, dateOnlyLabel)
	hasSkipped := hasLabel(task.Labels, skippedLabel)
	hasFixedDueTime := hasLabel(task.Labels, fixedDueTimeLabel)
	hasRecurrence := task.RepeatAfter > 0 || task.RepeatMode != 0
	kind := classifyWorkflow(task, hasRecurrence)
	if hasFixedDueTime && !fixedDueTimeEligible(task) {
		kind = TaskKindInvalid
	}

	var outcome CompletionOutcome
	if task.Done && kind != TaskKindInvalid {
		outcome = CompletionOutcomeCompleted
		if hasSkipped {
			outcome = CompletionOutcomeSkipped
		}
	}

	return TaskClassification{
		Kind: kind, DateOnly: hasDateOnly, FixedDueTime: hasFixedDueTime,
		Recurring: hasRecurrence && kind != TaskKindInvalid, Outcome: outcome,
	}
}

func classifyWorkflow(task vikunja.Task, recurring bool) TaskKind {
	history := hasLabel(task.Labels, recurrenceHistoryLabel)
	skipped := hasLabel(task.Labels, skippedLabel)
	// Both markers require a completed, non-recurring history snapshot.
	if (history || skipped) && (!history || !task.Done || recurring) {
		return TaskKindInvalid
	}
	if hasLabel(task.Labels, jobLabel) {
		return TaskKindJob
	}
	if history || recurring {
		return TaskKindRecurring
	}
	return TaskKindOneTime
}

func fixedDueTimeEligible(task vikunja.Task) bool {
	return !task.Done && !task.DueDate.IsZero() && task.RepeatAfter > 0 &&
		task.RepeatAfter%recurrenceDaySeconds == 0 && task.RepeatMode == vikunja.RepeatModeFromCompletion &&
		!hasLabel(task.Labels, dateOnlyLabel) && !hasLabel(task.Labels, recurrenceHistoryLabel) &&
		!hasLabel(task.Labels, skippedLabel) && validFixedTimeSchedule(task)
}

func validFixedTimeSchedule(task vikunja.Task) bool {
	if !hasLabel(task.Labels, jobLabel) {
		return true
	}
	return !task.StartDate.IsZero() && !task.EndDate.IsZero() &&
		task.EndDate.After(task.StartDate) && task.DueDate.After(task.EndDate)
}

func hasLabel(labels []vikunja.Label, title string) bool {
	for _, label := range labels {
		if label.Title == title {
			return true
		}
	}
	return false
}
