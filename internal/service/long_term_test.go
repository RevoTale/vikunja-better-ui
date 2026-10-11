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

func TestLongTermUndatedPriorityPrecedesProject(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 22, 12, 0, 0, 0, time.UTC)
	tasks := []vikunja.Task{
		{ID: 1, Title: "Low", ProjectID: 1, Priority: 1},
		{ID: 2, Title: "High", ProjectID: 2, Priority: 4},
		{ID: 3, Title: "High first project", ProjectID: 1, Priority: 4},
		{ID: 4, Title: "Later", DueDate: now.AddDate(0, 0, 8)},
		{ID: 5, Title: "Later urgent", Priority: 4, DueDate: now.AddDate(0, 0, 9)},
	}
	items := BuildTaskList(tasks, map[int64]string{1: "A", 2: "Z"}, TaskScopeLongTerm,
		now, time.UTC, time.Monday)
	want := []int64{4, 5, 3, 2, 1}
	if len(items) != len(want) {
		t.Fatalf("want %d tasks, got %d", len(want), len(items))
	}
	for index, id := range want {
		if items[index].Task.ID != id {
			t.Fatalf("position %d: want task %d, got %d", index, id, items[index].Task.ID)
		}
	}
}
