package vikunja

import (
	"encoding/json"
	"testing"
)

func TestReminderPatchDistinguishesPreserveAndClear(t *testing.T) {
	t.Parallel()
	empty := []TaskReminder{}
	if len(taskPatchOperations(TaskPatch{})) != 0 {
		t.Fatal("omitted reminders create a patch")
	}
	operations := taskPatchOperations(TaskPatch{Reminders: &empty})
	data, err := json.Marshal(operations)
	if err != nil || string(data) != `[{"op":"replace","path":"/reminders","value":[]}]` {
		t.Fatalf("clear patch: %s, %v", data, err)
	}
	var absent []TaskReminder
	data, err = json.Marshal(taskCheckOperations(TaskCheck{Reminders: &absent}))
	if err != nil || string(data) != `[{"op":"test","path":"/reminders","value":null}]` {
		t.Fatalf("null check: %s, %v", data, err)
	}
}
