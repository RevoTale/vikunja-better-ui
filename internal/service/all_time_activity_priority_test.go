package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestAllTimeActivityPreservesPriorityTimelinessWithoutExtraReads(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	stub := &allTimeStub{tasks: []vikunja.ActivityTask{
		{Done: true, DoneAt: now, DueDate: now, Priority: 3},
		{Done: true, DoneAt: now, DueDate: now.Add(-time.Hour), Priority: 3},
		{Done: true, DoneAt: now, Priority: 1},
		{Done: true, DoneAt: now, DueDate: now, Priority: 0},
		{Done: true, DoneAt: now, Priority: 5, Labels: []vikunja.Label{{Title: skippedLabel}}},
	}}
	cache := NewPublicAllTimeActivity(stub, func() time.Time { return now })
	summary, err := cache.Read(t.Context())
	if err != nil || len(summary.Weeks) != 1 {
		t.Fatalf("summary=%+v error=%v", summary, err)
	}
	priorities := summary.Weeks[0].Priorities
	if priorities[3].Count != 2 || priorities[3].WithDeadlineCount != 2 || priorities[3].OnTimeCount != 1 ||
		priorities[1].Count != 1 || priorities[1].WithDeadlineCount != 0 || priorities[0].OnTimeCount != 1 ||
		priorities[5].Count != 0 {
		t.Fatalf("incorrect priority cohorts: %+v", priorities)
	}
	if _, err := cache.Read(t.Context()); err != nil || stub.calls.Load() != 1 {
		t.Fatalf("priority breakdown added upstream reads: %v, calls=%d", err, stub.calls.Load())
	}
}
