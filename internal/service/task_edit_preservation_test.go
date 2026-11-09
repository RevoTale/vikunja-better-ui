package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestPartialEditRetainsDSTFoldInstants(t *testing.T) {
	t.Parallel()
	location, err := time.LoadLocation("Europe/Berlin")
	if err != nil {
		t.Fatal(err)
	}
	due := time.Date(2026, time.October, 25, 0, 30, 15, 123, time.UTC)
	before := vikunja.Task{Title: "Before", DueDate: due, StartDate: due.Add(-time.Minute), EndDate: due.Add(time.Minute)}
	input := EditTaskInput{Title: "After", DueDate: "2026-10-25", DueTime: "02:30", StartLocal: "2026-10-25T02:29",
		EndLocal: "2026-10-25T02:31", PreserveDates: EditDatePreservation{Due: true, Start: true, End: true}}
	write, _, err := buildEditedTask(input, location, before)
	if err != nil {
		t.Fatal(err)
	}
	if !write.DueDate.Equal(before.DueDate) ||
		!write.StartDate.Equal(before.StartDate) || !write.EndDate.Equal(before.EndDate) {
		t.Fatal("partial edit changed a stored DST fold instant")
	}
	input.PreserveDates = EditDatePreservation{}
	if _, _, err := buildEditedTask(input, location, before); err == nil {
		t.Fatal("ambiguous new local time accepted")
	}
}
