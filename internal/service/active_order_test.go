package service

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestActiveWorkOrderBeforePagination(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	task := func(id, start, end int, labels ...vikunja.Label) vikunja.Task {
		return vikunja.Task{ID: int64(id), StartDate: now.AddDate(0, 0, start), EndDate: now.AddDate(0, 0, end),
			Labels: labels}
	}
	alpha := vikunja.Label{ID: 8, Title: "alpha"}
	revisit := vikunja.Label{ID: 99, Title: "Revisit"}
	tasks := []vikunja.Task{
		task(1, -2, 1, vikunja.Label{ID: 9, Title: "vbu:date-only"}),
		task(2, -1, 2, revisit, alpha), task(3, -3, 3, vikunja.Label{ID: 7, Title: "Books"}, alpha),
		task(4, -4, 4, revisit), task(5, 1, 2, revisit),
	}
	for _, test := range []struct {
		order  ActiveWorkOrder
		filter []int64
		page   int
		want   []int64
	}{
		{ActiveWorkOrder{}, nil, 1, []int64{1, 2}},
		{ActiveWorkOrder{Sort: ActiveEndDesc}, nil, 1, []int64{4, 3}},
		{ActiveWorkOrder{Sort: ActiveStartAsc}, nil, 1, []int64{4, 3}},
		{ActiveWorkOrder{Sort: ActiveStartDesc}, nil, 1, []int64{2, 1}},
		{ActiveWorkOrder{Sort: ActiveLabelAsc}, nil, 1, []int64{2, 3}},
		{ActiveWorkOrder{Sort: ActiveLabelDesc}, nil, 2, []int64{3, 1}},
		{ActiveWorkOrder{Sort: ActiveStartAsc, RevisitFirst: true}, nil, 1, []int64{4, 2}},
		{ActiveWorkOrder{Sort: ActiveStartAsc, RevisitFirst: true}, []int64{8}, 1, []int64{2, 3}},
		{ActiveWorkOrder{Sort: ActiveStartAsc}, []int64{99}, 1, []int64{4, 2}},
	} {
		client := &listClientStub{pages: []vikunja.TaskPage{{
			Items: tasks, Total: int64(len(tasks)), TotalPages: 1, Page: 1, PerPage: 1000,
		}}}
		result, err := ListTasks(t.Context(), client, ListRequest{Scope: TaskScopeActive, Now: now,
			ActiveOrder: test.order, FilterLabelIDs: test.filter, Location: time.UTC, Timezone: "UTC",
			Page: test.page, PageSize: 2})
		if err != nil || !result.IsComplete {
			t.Fatalf("order %v: %v, complete=%t", test.order, err, result.IsComplete)
		}
		assertTaskIDs(t, result.Items, test.want...)
	}
}

func TestRevisitFirstUsesExactTitleAcrossLabelIDs(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 4, 12, 0, 0, 0, time.UTC)
	items := []vikunja.Task{
		{ID: 5, Title: "Last by ID", Labels: []vikunja.Label{{ID: 13, Title: "Revisit"}}},
		{ID: 1, Title: "First unpinned", Labels: []vikunja.Label{{ID: 7, Title: "revisit"}}},
		{ID: 4, Title: "Last by ID", Labels: []vikunja.Label{{ID: 18, Title: "Revisit"}}},
		{ID: 3, Title: "First by priority", Priority: 1, Labels: []vikunja.Label{{ID: 13, Title: "Revisit"}}},
		{ID: 2, Title: "Unlabeled"},
	}
	for i := range items {
		items[i].StartDate = now.Add(-time.Hour)
		items[i].EndDate = now.Add(time.Hour)
	}
	pages := []vikunja.TaskPage{{
		Items: items, Total: int64(len(items)), TotalPages: 1, Page: 1, PerPage: 1000,
	}}
	request := ListRequest{Scope: TaskScopeActive, Now: now, Location: time.UTC, Timezone: "UTC",
		ActiveOrder: ActiveWorkOrder{RevisitFirst: true}, PageSize: 2}
	for _, test := range []struct {
		page   int
		labels []int64
		want   []int64
	}{
		{1, nil, []int64{3, 4}},
		{2, nil, []int64{5, 1}},
		{3, nil, []int64{2}},
		{1, []int64{18}, []int64{4}},
	} {
		request.Page, request.FilterLabelIDs = test.page, test.labels
		result, err := ListTasks(t.Context(), &listClientStub{pages: pages}, request)
		if err != nil {
			t.Fatal(err)
		}
		assertTaskIDs(t, result.Items, test.want...)
	}
}
