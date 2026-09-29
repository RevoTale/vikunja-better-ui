package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type reuseClient struct {
	query vikunja.TaskQuery
	items []vikunja.Task
	pages [][]vikunja.Task
	err   error
}

func (c *reuseClient) Labels(context.Context) ([]vikunja.Label, error) {
	return []vikunja.Label{{ID: 4, Title: jobLabel}, {ID: 5, Title: recurrenceHistoryLabel}}, nil
}
func (c *reuseClient) TasksPage(_ context.Context, query vikunja.TaskQuery) (vikunja.TaskPage, error) {
	c.query = query
	if c.err != nil {
		return vikunja.TaskPage{}, c.err
	}
	if c.pages != nil {
		return vikunja.TaskPage{Items: c.pages[query.Page-1], TotalPages: int64(len(c.pages))}, nil
	}
	return vikunja.TaskPage{Items: c.items, TotalPages: 1}, nil
}

func TestLatestCreationReadsUntilMonthlyMatch(t *testing.T) {
	client := &reuseClient{pages: [][]vikunja.Task{
		{{ID: 9, CreatedBy: vikunja.User{ID: 3}}},
		{{ID: 8, CreatedBy: vikunja.User{ID: 3}, RepeatMode: 1}},
		{{ID: 7, CreatedBy: vikunja.User{ID: 3}, RepeatAfter: 86400}},
	}}
	task, err := LatestCreatedTask(t.Context(), client, 3, false, true)
	if err != nil || task == nil || task.ID != 8 || client.query.Page != 2 {
		t.Fatalf("result=%v err=%v page=%d", task, err, client.query.Page)
	}
	if strings.Contains(client.query.Filter, "repeat_mode") {
		t.Fatal("Vikunja 2.5 does not support this filter")
	}
}

func TestLatestCreationPropagatesFailure(t *testing.T) {
	failure := errors.New("upstream failed")
	client := &reuseClient{err: failure}
	if _, err := LatestCreatedTask(t.Context(), client, 3, false, false); !errors.Is(err, failure) {
		t.Fatalf("error=%v", err)
	}
	if _, err := LatestCreatedTask(t.Context(), client, 0, false, false); err == nil {
		t.Fatal("accepted missing identity")
	}
}

func TestLatestCreationSeparatesVariants(t *testing.T) {
	variants := []struct{ job, recurring bool }{
		{false, false}, {false, true}, {true, false}, {true, true},
	}
	for _, variant := range variants {
		job, recurring := variant.job, variant.recurring
		task := vikunja.Task{ID: 9, CreatedBy: vikunja.User{ID: 3}}
		if job {
			task.Labels = []vikunja.Label{{ID: 4, Title: jobLabel}}
		}
		if recurring {
			task.RepeatAfter = 86400
		}
		client := &reuseClient{items: []vikunja.Task{task}}
		result, err := LatestCreatedTask(t.Context(), client, 3, job, recurring)
		if err != nil || result == nil || result.ID != 9 {
			t.Fatalf("result = %v, %v", result, err)
		}
		if !strings.Contains(client.query.Filter, "created_by_id = 3") ||
			!strings.Contains(client.query.Filter, "labels not in 5") {
			t.Fatalf("unsafe filter: %s", client.query.Filter)
		}
		if client.query.SortBy[0] != "created" || client.query.OrderBy[0] != "desc" {
			t.Fatal("not newest first")
		}
	}
}

func TestLatestCreationRejectsOtherAuthorsAndHistory(t *testing.T) {
	client := &reuseClient{items: []vikunja.Task{
		{ID: 2, CreatedBy: vikunja.User{ID: 4}},
		{ID: 3, CreatedBy: vikunja.User{ID: 3}, Done: true, Labels: []vikunja.Label{{Title: recurrenceHistoryLabel}}},
	}}
	task, err := LatestCreatedTask(t.Context(), client, 3, false, false)
	if err != nil || task != nil {
		t.Fatalf("result = %v, %v", task, err)
	}
}
