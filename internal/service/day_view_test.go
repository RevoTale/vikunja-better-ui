package service

import (
	"context"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestDayViewRejectsExcessiveProjections(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 1, 12, 0, 0, 0, time.UTC)
	result := BuildDayView([]vikunja.Task{{ID: 1, DueDate: now, RepeatAfter: 1}}, WeekRequest{
		Now: now, Containing: now.AddDate(0, 0, 1), Location: time.UTC,
	})
	if result.IsComplete || result.Issue == nil || result.Issue.Code != ListIssueTooLarge {
		t.Fatalf("expected explicit projection limit, got complete=%v issue=%+v", result.IsComplete, result.Issue)
	}
	if len(result.Days[0].Projections) != 0 {
		t.Fatal("must not present a truncated schedule as complete")
	}
}

func TestListDayPushesProjectAndLabelFiltersUpstream(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 1, 12, 0, 0, 0, time.UTC)
	projectID := int64(7)
	client := &listClientStub{pages: []vikunja.TaskPage{{Page: 1, TotalPages: 1}}}
	result, err := ListDay(context.Background(), client, WeekRequest{
		Now: now, Containing: now.AddDate(0, 0, 1), Location: time.UTC, Timezone: "UTC",
		ProjectID: &projectID, LabelIDs: []int64{3},
	})
	if err != nil || !result.IsComplete || len(client.queries) != 1 {
		t.Fatalf("ListDay: result=%+v error=%v queries=%+v", result, err, client.queries)
	}
	want := "done = false && due_date < '2026-10-03T00:00:00Z' && " +
		"(due_date >= '2026-10-02T00:00:00Z' || repeat_after > 0) && project = 7 && labels in 3"
	if client.queries[0].Filter != want {
		t.Fatalf("query = %s, want %s", client.queries[0].Filter, want)
	}
}

func TestDayViewProjectsEarlierCyclesIntoOnlySelectedDay(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 1, 12, 0, 0, 0, time.UTC)
	request := WeekRequest{Now: now, Containing: now.AddDate(0, 0, 2), Location: time.UTC, Timezone: "UTC"}
	tasks := []vikunja.Task{
		{ID: 1, DueDate: now, RepeatAfter: 86400},
		{ID: 2, DueDate: request.Containing},
		{ID: 3, DueDate: now, RepeatAfter: 86400, RepeatMode: 2},
		{ID: 4, DueDate: now.AddDate(0, 0, 3)},
	}
	result := BuildDayView(tasks, request)
	if len(result.Days) != 1 || len(result.Days[0].Items) != 1 || len(result.Days[0].Projections) != 1 {
		t.Fatalf("want one real and one computed occurrence on only the selected day: %+v", result)
	}
	if result.Days[0].Items[0].Task.ID != 2 || result.Days[0].Projections[0].Source.Task.ID != 1 {
		t.Fatalf("wrong real/computed source: %+v", result.Days[0])
	}
}

func TestDayRangeUsesLocalMidnightAcrossDST(t *testing.T) {
	t.Parallel()
	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	date := time.Date(2026, time.October, 25, 12, 0, 0, 0, location)
	result := BuildDayView(nil, WeekRequest{Now: date, Containing: date, Location: location})
	if result.End.Sub(result.Start) != 25*time.Hour || len(result.Days) != 1 {
		t.Fatalf("expected one 25-hour local day, got %+v", result)
	}
}
