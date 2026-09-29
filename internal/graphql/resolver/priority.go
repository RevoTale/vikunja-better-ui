package resolver

import (
	"fmt"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
)

const (
	priorityUnset int64 = iota
	priorityLow
	priorityMedium
	priorityHigh
	priorityUrgent
	priorityDoNow
)

func priorityModel(value int64) (model.TaskPriority, error) {
	switch value {
	case priorityUnset:
		return model.TaskPriorityUnset, nil
	case priorityLow:
		return model.TaskPriorityLow, nil
	case priorityMedium:
		return model.TaskPriorityMedium, nil
	case priorityHigh:
		return model.TaskPriorityHigh, nil
	case priorityUrgent:
		return model.TaskPriorityUrgent, nil
	case priorityDoNow:
		return model.TaskPriorityDoNow, nil
	default:
		return "", fmt.Errorf("unsupported Vikunja priority %d", value)
	}
}

func priorityValue(priority model.TaskPriority) (int64, error) {
	switch priority {
	case model.TaskPriorityLow:
		return priorityLow, nil
	case model.TaskPriorityMedium:
		return priorityMedium, nil
	case model.TaskPriorityHigh:
		return priorityHigh, nil
	case model.TaskPriorityUrgent:
		return priorityUrgent, nil
	case model.TaskPriorityDoNow:
		return priorityDoNow, nil
	case model.TaskPriorityUnset:
		return priorityUnset, nil
	}
	return 0, fmt.Errorf("unsupported GraphQL priority %q", priority)
}
