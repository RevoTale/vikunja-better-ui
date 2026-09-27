package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestCommentCountsDoNotChangeTaskEditVersion(t *testing.T) {
	t.Parallel()
	task := vikunja.Task{ID: 1, Title: "Task"}
	want := TaskVersion(task)
	for _, count := range []int64{0, 1, 20} {
		task.CommentCount = &count
		if got := TaskVersion(task); got != want {
			t.Fatal("comment count changed task edit version")
		}
	}
}

func TestCommentCountExpansionStaysScopedToUILists(t *testing.T) {
	t.Parallel()
	for _, include := range []bool{false, true} {
		request := ListRequest{Scope: TaskScopeUnscheduled, IncludeCommentCount: include}
		if candidateTaskQuery(request).IncludeCommentCount != include || historyTaskQuery(request).IncludeCommentCount != include {
			t.Fatal("list query lost the comment count preference")
		}
	}
	now := time.Date(2026, time.September, 28, 12, 0, 0, 0, time.UTC)
	if !weekTaskQuery(WeekRequest{Now: now, Location: time.UTC}, now, now.AddDate(0, 0, 7)).IncludeCommentCount {
		t.Fatal("week query omitted comment counts")
	}
}
