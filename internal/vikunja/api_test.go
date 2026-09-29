package vikunja

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func TestClientTaskRoundTrip(t *testing.T) {
	t.Parallel()

	dueAt := time.Date(2026, time.August, 13, 12, 0, 0, 0, time.UTC)
	server := httptest.NewServer(taskRoundTripHandler(t, dueAt))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	task, metadata, err := client.Task(context.Background(), 42)
	if err != nil {
		t.Fatalf("Task() error = %v", err)
	}
	if task.ID != 42 || !task.DueDate.Equal(dueAt) || len(task.Labels) != 1 || metadata.ETag != `"task-v1"` {
		t.Fatalf("Task() = %#v, %#v", task, metadata)
	}

	created, err := client.CreateTask(context.Background(), 7, TaskWrite{Title: "Created"})
	if err != nil || created.ID != 43 {
		t.Fatalf("CreateTask() = %#v, %v", created, err)
	}
	htmlTask, err := client.CreateTaskHTML(context.Background(), 7, TaskWrite{Title: "HTML snapshot"})
	if err != nil || htmlTask.ID != 44 {
		t.Fatalf("CreateTaskHTML() = %#v, %v", htmlTask, err)
	}

	patched, err := client.PatchTask(context.Background(), 42, TaskPatch{Done: new(true)}, `"task-v1"`)
	if err != nil || !patched.Done {
		t.Fatalf("PatchTask() = %#v, %v", patched, err)
	}
}

func TestClientDeleteTaskUsesV2TaskEndpoint(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodDelete || request.URL.Path != "/api/v2/tasks/42" {
			t.Fatalf("request = %s %s", request.Method, request.URL.Path)
		}
		writer.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(server.Close)

	if err := testClient(t, server.URL, "test-token").DeleteTask(context.Background(), 42); err != nil {
		t.Fatalf("DeleteTask() error = %v", err)
	}
}

func TestClientDeleteTaskRejectsInvalidID(t *testing.T) {
	t.Parallel()

	if err := testClient(t, "http://example.test", "test-token").DeleteTask(context.Background(), 0); err == nil {
		t.Fatal("DeleteTask() error = nil, want invalid ID error")
	}
}

func TestClientTasksBuildsPinnedQuery(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(pinnedQueryHandler(t))
	t.Cleanup(server.Close)

	includeNulls := true
	page, err := testClient(t, server.URL, "test-token").TasksPage(context.Background(), TaskQuery{
		Page: 2, PerPage: 30, Filter: "done = false", FilterTimezone: "Europe/Kyiv",
		FilterIncludeNulls: &includeNulls, SortBy: []string{"done_at", "id"}, OrderBy: []string{"desc", "desc"},
	})
	if err != nil {
		t.Fatalf("TasksPage() error = %v", err)
	}
	if page.Total != 31 || len(page.Items) != 1 || page.Items[0].ID != 8 {
		t.Fatalf("TasksPage() = %#v", page)
	}
}

func TestClientPatchTaskCheckedUsesJSONPatchTests(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPatch || request.URL.Path != "/api/v2/tasks/42" {
			t.Fatalf("request = %s %s", request.Method, request.URL.Path)
		}
		if got := request.Header.Get("Content-Type"); got != "application/json-patch+json" {
			t.Errorf("Content-Type = %q", got)
		}
		var operations []jsonPatchOperation
		if err := json.NewDecoder(request.Body).Decode(&operations); err != nil {
			t.Fatal(err)
		}
		if len(operations) != 2 || operations[0].Operation != "test" || operations[0].Path != "/done" ||
			operations[1].Operation != "replace" || operations[1].Path != "/done" {
			t.Fatalf("operations = %#v", operations)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"id":42,"done":true}`))
	}))
	t.Cleanup(server.Close)

	done := true
	notDone := false
	task, err := testClient(t, server.URL, "test-token").PatchTaskChecked(
		context.Background(), 42, TaskPatch{Done: &done}, TaskCheck{Done: &notDone},
	)
	if err != nil || !task.Done {
		t.Fatalf("PatchTaskChecked() = %#v, %v", task, err)
	}
}

func TestClientPatchTaskCheckedReadsUnchangedTask(t *testing.T) {
	t.Parallel()
	for _, status := range []int{http.StatusOK, http.StatusForbidden} {
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodPatch {
					w.WriteHeader(http.StatusNotModified)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				_, _ = w.Write([]byte(`{"id":42,"title":"Unchanged"}`))
			}))
			t.Cleanup(server.Close)
			title := "Unchanged"
			task, err := testClient(t, server.URL, "test-token").PatchTaskChecked(t.Context(), 42,
				TaskPatch{Title: &title}, TaskCheck{Title: &title})
			if status == http.StatusOK {
				if err != nil || task.ID != 42 || task.Title != title {
					t.Fatalf("task = %#v, error = %v", task, err)
				}
			} else {
				var upstream *Error
				if !errors.As(err, &upstream) || upstream.Status != status {
					t.Fatalf("error = %v", err)
				}
			}
		})
	}
}

func TestTaskPatchOperationsReplacesWholeJobScheduleAfterTests(t *testing.T) {
	t.Parallel()

	nativeStart := time.Date(2026, time.August, 14, 9, 0, 0, 0, time.UTC)
	nativeEnd := nativeStart.Add(time.Hour)
	nativeDue := nativeEnd.Add(time.Hour)
	targetStart := nativeStart.Add(48 * time.Hour)
	targetEnd := targetStart.Add(time.Hour)
	targetDue := targetEnd.Add(time.Hour)
	operations := append(
		taskCheckOperations(TaskCheck{
			StartDate: &nativeStart, EndDate: &nativeEnd, DueDate: &nativeDue,
		}),
		taskPatchOperations(TaskPatch{
			StartDate: &targetStart, EndDate: &targetEnd, DueDate: &targetDue,
		})...,
	)
	want := []struct {
		operation string
		path      string
	}{
		{"test", "/due_date"}, {"test", "/start_date"}, {"test", "/end_date"},
		{"replace", "/due_date"}, {"replace", "/start_date"}, {"replace", "/end_date"},
	}
	if len(operations) != len(want) {
		t.Fatalf("operations = %#v", operations)
	}
	for index, expected := range want {
		if operations[index].Operation != expected.operation || operations[index].Path != expected.path {
			t.Fatalf("operations[%d] = %#v, want %#v", index, operations[index], expected)
		}
	}
}

func TestClientTasksRejectsInvalidQuery(t *testing.T) {
	t.Parallel()

	client := testClient(t, "http://example.test", "test-token")
	testCases := []TaskQuery{
		{Page: 0, PerPage: 30},
		{Page: 1, PerPage: 1001},
		{Page: 1, PerPage: 30, SortBy: []string{"id"}},
		{Page: 1, PerPage: 30, Search: "needle", Filter: "done = true"},
	}
	for _, query := range testCases {
		if _, err := client.TasksPage(context.Background(), query); err == nil {
			t.Fatalf("TasksPage(%#v) error = nil", query)
		}
	}
}

func taskRoundTripHandler(t *testing.T, dueAt time.Time) http.HandlerFunc {
	t.Helper()
	return func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch {
		case request.Method == http.MethodGet && request.URL.Path == "/api/v2/tasks/42":
			if request.URL.Query().Has("format") {
				t.Errorf("GET format = %q", request.URL.Query().Get("format"))
			}
			writer.Header().Set("ETag", `"task-v1"`)
			_, _ = fmt.Fprintf(
				writer,
				`{"id":42,"title":"Read","due_date":%q,"labels":[{"id":3,"title":"job"}]}`,
				dueAt.Format(time.RFC3339),
			)
		case request.Method == http.MethodPost && request.URL.Path == "/api/v2/projects/7/tasks":
			if request.URL.Query().Get("format") == "markdown" {
				writer.WriteHeader(http.StatusCreated)
				_, _ = writer.Write([]byte(`{"id":43,"title":"Created"}`))
				return
			}
			writer.WriteHeader(http.StatusCreated)
			_, _ = writer.Write([]byte(`{"id":44,"title":"HTML snapshot"}`))
		case request.Method == http.MethodPatch && request.URL.Path == "/api/v2/tasks/42":
			if request.URL.Query().Has("format") {
				t.Errorf("PATCH format = %q", request.URL.Query().Get("format"))
			}
			if got := request.Header.Get("If-Match"); got != `"task-v1"` {
				t.Errorf("If-Match = %q", got)
			}
			_, _ = writer.Write([]byte(`{"id":42,"title":"Read","done":true}`))
		default:
			t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
		}
	}
}

func pinnedQueryHandler(t *testing.T) http.HandlerFunc {
	t.Helper()
	return func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v2/tasks" {
			t.Errorf("path = %q", request.URL.Path)
		}
		query := request.URL.Query()
		if query.Get("page") != "2" || query.Get("per_page") != "30" {
			t.Errorf("pagination query = %q", request.URL.RawQuery)
		}
		if query.Has("format") {
			t.Errorf("format = %q", query.Get("format"))
		}
		if query.Get("filter") != "done = false" || query.Get("filter_timezone") != "Europe/Kyiv" {
			t.Errorf("filter query = %q", request.URL.RawQuery)
		}
		if query.Get("filter_include_nulls") != "true" {
			t.Errorf("filter_include_nulls = %q", query.Get("filter_include_nulls"))
		}
		if got := query["sort_by"]; len(got) != 2 || got[0] != "done_at" || got[1] != "id" {
			t.Errorf("sort_by = %#v", got)
		}
		if got := query["order_by"]; len(got) != 2 || got[0] != "desc" || got[1] != "desc" {
			t.Errorf("order_by = %#v", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"items":[{"id":8,"title":"Done"}],"total":31,"page":2,"per_page":30,"total_pages":2}`))
	}
}
