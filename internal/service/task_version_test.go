package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestTaskVersionRejectsUnrepresentableTime(t *testing.T) {
	task := vikunja.Task{ID: 1, DueDate: time.Date(10000, time.January, 1, 0, 0, 0, 0, time.UTC)}
	if version := TaskVersion(task); version != "" {
		t.Fatalf("unrepresentable task received edit token %q", version)
	}
}
