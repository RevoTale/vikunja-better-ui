package service

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

var benchmarkListResult ListResult

type benchmarkListClient struct {
	pages []vikunja.TaskPage
}

func (client benchmarkListClient) TasksPage(_ context.Context, query vikunja.TaskQuery) (vikunja.TaskPage, error) {
	return client.pages[query.Page-1], nil
}

func BenchmarkListActiveTasks(b *testing.B) {
	const taskCount = 5000
	now := time.Date(2026, time.August, 15, 12, 0, 0, 0, time.UTC)
	client := benchmarkListClient{pages: benchmarkTaskPages(taskCount, 1000, now)}
	projectTitles := make(map[int64]string, 10)
	for projectID := int64(1); projectID <= 10; projectID++ {
		projectTitles[projectID] = "Project " + strconv.FormatInt(projectID, 10)
	}
	request := ListRequest{
		Scope: TaskScopeToday, Page: 1, PageSize: 30, Now: now,
		Location: time.UTC, Timezone: "UTC", WeekStart: time.Monday, ProjectTitles: projectTitles,
	}

	b.ReportAllocs()
	for b.Loop() {
		result, err := ListTasks(context.Background(), client, request)
		if err != nil {
			b.Fatal(err)
		}
		benchmarkListResult = result
	}
}

func benchmarkTaskPages(taskCount int, pageSize int, now time.Time) []vikunja.TaskPage {
	pageCount := (taskCount + pageSize - 1) / pageSize
	pages := make([]vikunja.TaskPage, pageCount)
	for pageIndex := range pages {
		start := pageIndex * pageSize
		end := min(start+pageSize, taskCount)
		tasks := make([]vikunja.Task, end-start)
		for itemIndex := range tasks {
			index := start + itemIndex
			tasks[itemIndex] = vikunja.Task{
				ID: int64(index + 1), Title: "Task " + strconv.Itoa(index+1),
				DueDate:   now.Add(time.Duration(index%720-360) * time.Minute),
				ProjectID: int64(index%10 + 1), Priority: int64(index % 6),
				Labels: []vikunja.Label{{ID: int64(index%5 + 1), Title: "benchmark-label"}},
			}
		}
		pages[pageIndex] = vikunja.TaskPage{
			Items: tasks, Total: int64(taskCount), Page: int64(pageIndex + 1),
			PerPage: int64(pageSize), TotalPages: int64(pageCount),
		}
	}
	return pages
}
