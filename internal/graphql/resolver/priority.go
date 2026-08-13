package resolver

import (
	"fmt"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
)

func priorityModel(value int64) (model.TaskPriority, error) {
	switch value {
	case 0:
		return model.TaskPriorityUnset, nil
	case 1:
		return model.TaskPriorityLow, nil
	case 2:
		return model.TaskPriorityMedium, nil
	case 3:
		return model.TaskPriorityHigh, nil
	case 4:
		return model.TaskPriorityUrgent, nil
	case 5:
		return model.TaskPriorityDoNow, nil
	default:
		return "", fmt.Errorf("unsupported Vikunja priority %d", value)
	}
}

func priorityValue(priority model.TaskPriority) (int64, error) {
	switch priority {
	case model.TaskPriorityLow:
		return 1, nil
	case model.TaskPriorityMedium:
		return 2, nil
	case model.TaskPriorityHigh:
		return 3, nil
	case model.TaskPriorityUrgent:
		return 4, nil
	case model.TaskPriorityDoNow:
		return 5, nil
	case model.TaskPriorityUnset:
		return 0, nil
	}
	return 0, fmt.Errorf("unsupported GraphQL priority %q", priority)
}
