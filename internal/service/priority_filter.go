package service

import (
	"errors"
	"strconv"
)

func validatePriority(priority *int64) error {
	const highestPriority = 5
	if priority != nil && (*priority < 0 || *priority > highestPriority) {
		return errors.New("priority must be between zero and five")
	}
	return nil
}

func appendPriorityFilter(parts []string, priority *int64) []string {
	if priority == nil {
		return parts
	}
	return append(parts, "priority = "+strconv.FormatInt(*priority, 10))
}

func matchesPriority(value int64, priority *int64) bool {
	return priority == nil || value == *priority
}

func filterCandidatesByPriority(candidates []taskListCandidate, priority *int64) []taskListCandidate {
	if priority == nil {
		return candidates
	}
	filtered := candidates[:0]
	for _, candidate := range candidates {
		if matchesPriority(candidate.Task.Priority, priority) {
			filtered = append(filtered, candidate)
		}
	}
	return filtered
}
