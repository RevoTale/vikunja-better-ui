package resolver

import (
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func reminderInputs(inputs []*model.TaskReminderInput) []service.ReminderInput {
	if inputs == nil {
		return nil
	}
	result := make([]service.ReminderInput, 0, len(inputs))
	for _, input := range inputs {
		local := ""
		if input.LocalAt != nil {
			local = string(*input.LocalAt)
		}
		result = append(result, service.ReminderInput{
			At: input.At, LocalAt: local, RelativeTo: input.RelativeTo,
			RelativePeriod: int64(input.RelativePeriod),
		})
	}
	return result
}

func reminderModels(reminders []vikunja.TaskReminder) []*model.TaskReminder {
	result := make([]*model.TaskReminder, 0, len(reminders))
	for _, reminder := range reminders {
		result = append(result, &model.TaskReminder{
			At: optionalTime(reminder.Reminder), RelativeTo: reminder.RelativeTo,
			RelativePeriod: int(reminder.RelativePeriod),
		})
	}
	return result
}
