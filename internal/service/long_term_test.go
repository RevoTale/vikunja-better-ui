package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestLongTermIncludesUndatedAndBeyondSevenLocalDays(t *testing.T) {
	t.Parallel()
	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, time.October, 22, 12, 0, 0, 0, location)
	boundary := now.AddDate(0, 0, 7)
	tasks := []vikunja.Task{
		{ID: 1, Title: "No deadline"},
		{ID: 2, DueDate: boundary.Add(time.Second)},
		{ID: 3, DueDate: boundary},
		{ID: 4, DueDate: now.Add(-time.Hour)},
		{ID: 5, Done: true},
		{ID: 6, DueDate: boundary.Add(time.Hour), Done: true},
	}
	items := BuildTaskList(tasks, nil, TaskScope("LONG_TERM"), now, location, time.Monday)
	if len(items) != 2 || items[0].Task.ID != 2 || items[1].Task.ID != 1 {
		t.Fatalf("want future task then undated task, got %+v", items)
	}
}
