package resolver

import (
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
)

func TestSelectedTaskPriorityDistinguishesAllFromUnset(t *testing.T) {
	t.Parallel()
	for _, scope := range []model.TaskScope{
		model.TaskScopeToday, model.TaskScopeLongTerm, model.TaskScopeUnscheduled, model.TaskScopeJobs,
	} {
		value, err := selectedTaskPriority(nil, scope)
		if err != nil || value != nil {
			t.Fatalf("omitted priority must mean all: %v %v", value, err)
		}
		for index, priority := range model.AllTaskPriority {
			value, err = selectedTaskPriority(&priority, scope)
			if err != nil || value == nil || *value != int64(index) {
				t.Fatalf("priority %s: %v %v", priority, value, err)
			}
		}
	}
}

func TestSelectedTaskPriorityRejectsUnsupportedFilters(t *testing.T) {
	t.Parallel()
	priority := model.TaskPriorityHigh
	for _, scope := range []model.TaskScope{model.TaskScopeWeek, model.TaskScopeMonth, model.TaskScopeHistory} {
		_, err := selectedTaskPriority(&priority, scope)
		assertErrorCode(t, err, "VALIDATION_FAILED")
	}
	priority = "INVALID"
	_, err := selectedTaskPriority(&priority, model.TaskScopeToday)
	assertErrorCode(t, err, "VALIDATION_FAILED")
}
