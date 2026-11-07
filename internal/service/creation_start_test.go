package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestCreationStartNow(t *testing.T) {
	t.Parallel()
	start := time.Date(2026, time.November, 6, 0, 0, 0, 0, time.UTC)
	now := start.Add(12*time.Hour + 34*time.Second + 500*time.Millisecond)
	end := start.Add(18 * time.Hour)
	past := start.Add(10 * time.Hour)
	instant := now.Truncate(time.Second)
	for _, test := range []struct {
		name  string
		write vikunja.TaskWrite
		want  *time.Time
	}{
		{name: "plan", write: vikunja.TaskWrite{StartDate: &start, EndDate: &end}, want: &instant},
		{name: "repeat", write: vikunja.TaskWrite{StartDate: &start, DueDate: &end}, want: &instant},
		{name: "past", write: vikunja.TaskWrite{StartDate: &start, EndDate: &past}, want: &start},
		{name: "no window", write: vikunja.TaskWrite{DueDate: &end}},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			ApplyCreationStartNow(&test.write, now)
			if test.want == nil {
				if test.write.StartDate != nil {
					t.Fatal("unexpected availability")
				}
				return
			}
			if test.write.StartDate == nil || !test.write.StartDate.Equal(*test.want) {
				t.Fatalf("start = %v, want %v", test.write.StartDate, test.want)
			}
		})
	}
}
