package vikunja

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"
	"time"
)

func TestClientCoalescesOnlyConcurrentCurrentUserRequests(t *testing.T) {
	t.Parallel()

	assertConcurrentRequestsCoalesced(t, `{
		"id": 7,
		"username": "test-user",
		"settings": {"timezone": "UTC", "week_start": 1}
	}`, func(ctx context.Context, client *Client) error {
		_, err := client.CurrentUser(ctx)
		return err
	})
}

func TestClientCoalescesOnlyConcurrentProjectRequests(t *testing.T) {
	t.Parallel()

	assertConcurrentRequestsCoalesced(t, `{
		"items": [{"id": 7, "title": "Home"}],
		"total": 1,
		"page": 1,
		"per_page": 1000,
		"total_pages": 1
	}`, func(ctx context.Context, client *Client) error {
		_, err := client.Projects(ctx)
		return err
	})
}

func TestClientCoalescesOnlyConcurrentLabelRequests(t *testing.T) {
	t.Parallel()

	assertConcurrentRequestsCoalesced(t, `{
		"items": [{"id": 4, "title": "job"}],
		"total": 1,
		"page": 1,
		"per_page": 1000,
		"total_pages": 1
	}`, func(ctx context.Context, client *Client) error {
		_, err := client.Labels(ctx)
		return err
	})
}

func TestClientCanceledCallerDoesNotCancelSharedMetadataRead(t *testing.T) {
	t.Parallel()

	started := make(chan struct{}, 1)
	release := make(chan struct{})
	var requestCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requestCount.Add(1)
		started <- struct{}{}
		<-release
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{
			"id": 7,
			"username": "test-user",
			"settings": {"timezone": "UTC", "week_start": 1}
		}`))
	}))
	t.Cleanup(server.Close)

	baseURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	client := NewClient(baseURL, "test-token")
	leaderContext, cancelLeader := context.WithCancel(t.Context())
	leaderDone := make(chan error, 1)
	go func() {
		_, callErr := client.CurrentUser(leaderContext)
		leaderDone <- callErr
	}()
	<-started

	waiterStarted := make(chan struct{})
	waiterDone := make(chan error, 1)
	go func() {
		close(waiterStarted)
		_, callErr := client.CurrentUser(t.Context())
		waiterDone <- callErr
	}()
	<-waiterStarted
	select {
	case <-started:
		close(release)
		t.Fatal("waiting caller started another upstream request")
	case <-time.After(50 * time.Millisecond):
	}
	cancelLeader()
	if callErr := <-leaderDone; !errors.Is(callErr, context.Canceled) {
		t.Fatalf("canceled caller error = %v", callErr)
	}
	close(release)
	if callErr := <-waiterDone; callErr != nil {
		t.Fatalf("waiting caller error = %v", callErr)
	}
	if requests := requestCount.Load(); requests != 1 {
		t.Fatalf("upstream requests = %d, want 1", requests)
	}
}

func TestClientCancelsSharedMetadataReadAfterAllCallersLeave(t *testing.T) {
	t.Parallel()

	started := make(chan struct{})
	requestCanceled := make(chan struct{})
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		close(started)
		select {
		case <-request.Context().Done():
			close(requestCanceled)
		case <-release:
		}
	}))
	t.Cleanup(func() {
		close(release)
		server.Close()
	})

	baseURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	client := NewClient(baseURL, "test-token")
	callerContext, cancelCaller := context.WithCancel(t.Context())
	callerDone := make(chan error, 1)
	go func() {
		_, callErr := client.CurrentUser(callerContext)
		callerDone <- callErr
	}()
	<-started
	cancelCaller()
	if callErr := <-callerDone; !errors.Is(callErr, context.Canceled) {
		t.Fatalf("canceled caller error = %v", callErr)
	}

	select {
	case <-requestCanceled:
	case <-time.After(250 * time.Millisecond):
		t.Fatal("upstream request continued after its final caller left")
	}
}

func assertConcurrentRequestsCoalesced(
	t *testing.T,
	response string,
	call func(context.Context, *Client) error,
) {
	t.Helper()

	const callers = 8
	requests := make(chan struct{}, callers+1)
	release := make(chan struct{})
	var requestCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requestCount.Add(1)
		requests <- struct{}{}
		<-release
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(response))
	}))
	t.Cleanup(server.Close)

	baseURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	client := NewClient(baseURL, "test-token")
	start := make(chan struct{})
	errors := make(chan error, callers)
	for range callers {
		go func() {
			<-start
			errors <- call(t.Context(), client)
		}()
	}
	close(start)

	select {
	case <-requests:
	case <-time.After(time.Second):
		close(release)
		t.Fatal("no upstream request started")
	}
	select {
	case <-requests:
		close(release)
		t.Fatal("concurrent calls started more than one upstream request")
	case <-time.After(100 * time.Millisecond):
	}
	close(release)
	for range callers {
		if callErr := <-errors; callErr != nil {
			t.Fatalf("concurrent call error = %v", callErr)
		}
	}
	if requests := requestCount.Load(); requests != 1 {
		t.Fatalf("upstream requests = %d, want 1", requests)
	}

	if err := call(t.Context(), client); err != nil {
		t.Fatalf("later call error = %v", err)
	}
	if requests := requestCount.Load(); requests != 2 {
		t.Fatalf("upstream requests after later call = %d, want 2", requests)
	}
}

func TestClientProjectsAcceptsEmptyPage(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"items":[],"total":0,"page":1,"per_page":1000,"total_pages":0}`))
	}))
	t.Cleanup(server.Close)

	projects, err := testClient(t, server.URL, "test-token").Projects(context.Background())
	if err != nil {
		t.Fatalf("Projects() error = %v", err)
	}
	if len(projects) != 0 {
		t.Fatalf("Projects() = %#v, want empty", projects)
	}
}

func TestClientCurrentUser(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v2/user" {
			t.Errorf("path = %q", request.URL.Path)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{
			"id": 7,
			"username": "test-user",
			"settings": {
				"timezone": "Europe/Kyiv",
				"week_start": 1,
				"default_project_id": 42
			}
		}`))
	}))
	t.Cleanup(server.Close)

	user, err := testClient(t, server.URL, "test-token").CurrentUser(context.Background())
	if err != nil {
		t.Fatalf("CurrentUser() error = %v", err)
	}
	if user.ID != 7 || user.Username != "test-user" {
		t.Fatalf("CurrentUser() = %#v", user)
	}
	if user.Settings.Timezone != "Europe/Kyiv" || user.Settings.WeekStart != 1 || user.Settings.DefaultProjectID != 42 {
		t.Fatalf("CurrentUser().Settings = %#v", user.Settings)
	}
}

func TestClientProjectsReadsEveryPage(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v2/projects" {
			t.Errorf("path = %q", request.URL.Path)
		}
		if got := request.URL.Query().Get("per_page"); got != "1000" {
			t.Errorf("per_page = %q", got)
		}
		if got := request.URL.Query().Get("expand"); got != "" {
			t.Errorf("unused expand = %q", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Query().Get("page") {
		case "1":
			items := make([]Project, 1000)
			for index := range items {
				items[index] = Project{ID: int64(index + 1), Title: fmt.Sprintf("Project %d", index+1)}
			}
			_ = json.NewEncoder(writer).Encode(page[Project]{
				Items: items, Total: 1001, Page: 1, PerPage: 1000, TotalPages: 2,
			})
		case "2":
			_ = json.NewEncoder(writer).Encode(page[Project]{
				Items: []Project{{ID: 1001, Title: "Last"}},
				Total: 1001, Page: 2, PerPage: 1000, TotalPages: 2,
			})
		default:
			t.Errorf("unexpected page %q", request.URL.Query().Get("page"))
		}
	}))
	t.Cleanup(server.Close)

	projects, err := testClient(t, server.URL, "test-token").Projects(context.Background())
	if err != nil {
		t.Fatalf("Projects() error = %v", err)
	}
	if len(projects) != 1001 || projects[0].ID != 1 || projects[1000].ID != 1001 {
		t.Fatalf("Projects() = %#v", projects)
	}
}

func TestClientProjectsRejectsInconsistentPagination(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{
			"items": [{"id": 1, "title": "First"}],
			"total": 2,
			"page": 2,
			"per_page": 1000,
			"total_pages": 2
		}`))
	}))
	t.Cleanup(server.Close)

	_, err := testClient(t, server.URL, "test-token").Projects(context.Background())
	if err == nil {
		t.Fatal("Projects() error = nil, want pagination error")
	}
}

func TestClientTaskRoundTrip(t *testing.T) {
	t.Parallel()

	dueAt := time.Date(2026, time.August, 13, 12, 0, 0, 0, time.UTC)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch {
		case request.Method == http.MethodGet && request.URL.Path == "/api/v2/tasks/42":
			if request.URL.Query().Has("format") {
				t.Errorf("GET format = %q", request.URL.Query().Get("format"))
			}
			writer.Header().Set("ETag", `"task-v1"`)
			_, _ = fmt.Fprintf(writer, `{"id":42,"title":"Read","due_date":%q,"labels":[{"id":3,"title":"job"}]}`, dueAt.Format(time.RFC3339))
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
	}))
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

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
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
	}))
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

func TestClientLabelRoundTrip(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch {
		case request.Method == http.MethodGet && request.URL.Path == "/api/v2/labels":
			_, _ = writer.Write([]byte(`{"items":[{"id":4,"title":"job"}],"total":1,"page":1,"per_page":1000,"total_pages":1}`))
		case request.Method == http.MethodPost && request.URL.Path == "/api/v2/labels":
			var input LabelWrite
			if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
				t.Errorf("decode label: %v", err)
			}
			if input.Title != "vbu:date-only" {
				t.Errorf("label title = %q", input.Title)
			}
			writer.WriteHeader(http.StatusCreated)
			_, _ = writer.Write([]byte(`{"id":5,"title":"vbu:date-only"}`))
		case request.Method == http.MethodPost && request.URL.Path == "/api/v2/tasks/9/labels":
			var input labelTask
			if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
				t.Errorf("decode attachment: %v", err)
			}
			if input.LabelID != 5 {
				t.Errorf("label_id = %d", input.LabelID)
			}
			writer.WriteHeader(http.StatusCreated)
			_, _ = writer.Write([]byte(`{"label_id":5}`))
		case request.Method == http.MethodDelete && request.URL.Path == "/api/v2/tasks/9/labels/5":
			writer.WriteHeader(http.StatusNoContent)
		default:
			t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
		}
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	labels, err := client.Labels(context.Background())
	if err != nil || len(labels) != 1 || labels[0].ID != 4 {
		t.Fatalf("Labels() = %#v, %v", labels, err)
	}
	created, err := client.CreateLabel(context.Background(), LabelWrite{Title: "vbu:date-only"})
	if err != nil || created.ID != 5 {
		t.Fatalf("CreateLabel() = %#v, %v", created, err)
	}
	if err := client.AttachLabel(context.Background(), 9, 5); err != nil {
		t.Fatalf("AttachLabel() error = %v", err)
	}
	if err := client.DetachLabel(context.Background(), 9, 5); err != nil {
		t.Fatalf("DetachLabel() error = %v", err)
	}
}
