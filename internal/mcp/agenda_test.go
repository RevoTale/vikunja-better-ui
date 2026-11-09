package mcp

import (
	"testing"
	"time"
)

func TestSessionOverlapsExcludeAdjacentAndMarkPartial(t *testing.T) {
	t.Parallel()
	start := time.Date(2026, time.November, 9, 12, 0, 0, 0, time.UTC)
	sessions := agendaSection{Complete: true, Items: []taskSummary{
		{ID: 1, AvailableFrom: instant(start), PlannedFinish: instant(start.Add(time.Hour))},
		{ID: 2, AvailableFrom: instant(start.Add(time.Hour)), PlannedFinish: instant(start.Add(2 * time.Hour))},
		{ID: 3, AvailableFrom: instant(start.Add(30 * time.Minute)), PlannedFinish: instant(start.Add(45 * time.Minute))},
	}}
	got, complete := sessionOverlaps(sessions)
	if !complete || len(got) != 1 || got[0].TaskID != 1 || got[0].OtherTaskID != 3 {
		t.Fatalf("unexpected overlaps: %#v, complete=%v", got, complete)
	}
	sessions.HasMore = true
	if _, complete := sessionOverlaps(sessions); complete {
		t.Fatal("partial sessions imply incomplete overlaps")
	}
}
