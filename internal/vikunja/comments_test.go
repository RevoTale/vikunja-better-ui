package vikunja

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
)

func TestClientTaskCommentsUsesVikunjaCommentEndpoints(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet ||
			request.URL.Path != "/api/v2/tasks/42/comments" ||
			request.URL.Query().Get("order_by") != "asc" {
			t.Errorf("request = %s %s, want GET /api/v2/tasks/42/comments", request.Method, request.URL.Path)
		}
		if request.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("Authorization = %q", request.Header.Get("Authorization"))
		}
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Query().Get("page") != "2" || request.URL.Query().Get("per_page") != "1" {
			t.Errorf("pagination = %s", request.URL.RawQuery)
		}
		_, _ = writer.Write([]byte(`{
			"items":[{"id":7,"comment":"<p>Hello</p>","author":{"id":9,"username":"writer"}}],
			"page":2,"per_page":1,"total":2,"total_pages":2
		}`))
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	page, err := client.TaskComments(context.Background(), 42, CommentQuery{Page: 2, PerPage: 1, Order: "asc"})
	if err != nil {
		t.Fatalf("TaskComments() error = %v", err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != 7 || page.Items[0].Author.Username != "writer" {
		t.Fatalf("comments = %#v", page)
	}
}

func TestClientCreateAndUpdateTaskCommentSendCommentBody(t *testing.T) {
	t.Parallel()

	var requests []string
	var mutex sync.Mutex
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var body TaskCommentWrite
		if err := json.NewDecoder(request.Body).Decode(&body); request.Method != http.MethodGet && err != nil {
			t.Errorf("decode request body: %v", err)
		}
		mutex.Lock()
		requests = append(requests, request.Method+" "+request.URL.Path+" "+body.Comment)
		mutex.Unlock()
		writer.Header().Set("Content-Type", "application/json")
		if request.Method == http.MethodPut {
			_, _ = writer.Write([]byte(`{"id":7,"comment":"<p>Edit</p>","author":null}`))
			return
		}
		_, _ = writer.Write([]byte(`{"id":7,"comment":"<p>Saved</p>","task_id":42,"author":{"id":9,"username":"writer"}}`))
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	if _, err := client.CreateTaskComment(context.Background(), 42, TaskCommentWrite{Comment: "<p>New</p>"}); err != nil {
		t.Fatalf("CreateTaskComment() error = %v", err)
	}
	if _, err := client.UpdateTaskComment(
		context.Background(),
		42,
		7,
		TaskCommentWrite{Comment: "<p>Edit</p>"},
	); err != nil {
		t.Fatalf("UpdateTaskComment() error = %v", err)
	}
	want := []string{
		"POST /api/v2/tasks/42/comments <p>New</p>",
		"PUT /api/v2/tasks/42/comments/7 <p>Edit</p>",
		"GET /api/v2/tasks/42/comments/7 ",
	}
	mutex.Lock()
	defer mutex.Unlock()
	if len(requests) != len(want) {
		t.Fatalf("requests = %#v, want %#v", requests, want)
	}
	for index := range want {
		if requests[index] != want[index] {
			t.Errorf("request[%d] = %q, want %q", index, requests[index], want[index])
		}
	}
}

func TestClientDeleteTaskCommentUsesCommentPath(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodDelete || request.URL.Path != "/api/v2/tasks/42/comments/7" {
			t.Errorf("request = %s %s, want DELETE /api/v2/tasks/42/comments/7", request.Method, request.URL.Path)
		}
		writer.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(server.Close)

	if err := testClient(t, server.URL, "test-token").DeleteTaskComment(context.Background(), 42, 7); err != nil {
		t.Fatalf("DeleteTaskComment() error = %v", err)
	}
}

func TestClientTaskCommentsRejectsWrongTaskOrMissingAuthor(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
	}{
		{
			name: "wrong task",
			body: `{"items":[{"id":7,"comment":"body","task_id":41,"author":{"id":9}}],
				"page":1,"per_page":50,"total":1,"total_pages":1}`,
		},
		{
			name: "missing author",
			body: `{"items":[{"id":7,"comment":"body","author":null}],"page":1,"per_page":50,"total":1,"total_pages":1}`,
		},
		{name: "legacy array", body: `[]`},
		{name: "missing page", body: `{}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				_, _ = writer.Write([]byte(test.body))
			}))
			t.Cleanup(server.Close)

			_, err := testClient(t, server.URL, "test-token").TaskComments(
				context.Background(),
				42,
				CommentQuery{Page: 1, PerPage: 50, Order: "asc"},
			)
			var upstream *Error
			if !errors.Is(err, ErrRejectedResponse) && (!errors.As(err, &upstream) || upstream.Code != "UPSTREAM_REJECTED") {
				t.Fatalf("TaskComments() error = %v, want ErrRejectedResponse", err)
			}
		})
	}
}

func TestCommentPaginationRespectsInstanceCap(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Query().Get("order_by") != "desc" {
			t.Error("descending order was not forwarded")
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"items":[{"id":7,"comment":"body","author":{"id":9}}],
			"page":1,"per_page":1,"total":2,"total_pages":2}`))
	}))
	t.Cleanup(server.Close)
	page, err := testClient(t, server.URL, "test-token").TaskComments(
		t.Context(),
		42,
		CommentQuery{Page: 1, PerPage: 50, Order: "desc"},
	)
	if err != nil || page.PerPage != 1 || page.TotalPages != 2 {
		t.Fatalf("capped page = %#v, error = %v", page, err)
	}
}

func TestCommentInvalidInputMakesNoRequest(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Error("invalid input reached Vikunja")
	}))
	t.Cleanup(server.Close)
	client := testClient(t, server.URL, "test-token")
	for _, query := range []CommentQuery{
		{Page: 0, PerPage: 50, Order: "asc"},
		{Page: 1, PerPage: 1001, Order: "asc"},
		{Page: 1, PerPage: 50, Order: "invalid"},
	} {
		if _, err := client.TaskComments(t.Context(), 42, query); err == nil {
			t.Error("invalid query accepted")
		}
	}
	if _, err := client.CreateTaskComment(t.Context(), 0, TaskCommentWrite{Comment: "body"}); err == nil {
		t.Error("invalid task accepted")
	}
	if _, err := client.UpdateTaskComment(t.Context(), 42, -1, TaskCommentWrite{Comment: "body"}); err == nil {
		t.Error("invalid comment accepted")
	}
	if err := client.DeleteTaskComment(t.Context(), 42, 0); err == nil {
		t.Error("invalid delete accepted")
	}
}

func TestCommentWritesPreservePermissionErrors(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusForbidden)
	}))
	t.Cleanup(server.Close)
	client := testClient(t, server.URL, "test-token")
	_, createErr := client.CreateTaskComment(t.Context(), 42, TaskCommentWrite{Comment: "body"})
	_, updateErr := client.UpdateTaskComment(t.Context(), 42, 7, TaskCommentWrite{Comment: "body"})
	deleteErr := client.DeleteTaskComment(t.Context(), 42, 7)
	for _, err := range []error{createErr, updateErr, deleteErr} {
		var upstream *Error
		if !errors.As(err, &upstream) || upstream.Status != http.StatusForbidden {
			t.Errorf("permission error lost: %v", err)
		}
	}
}

func TestCommentUpdateReadbackFailureDoesNotRetryWrite(t *testing.T) {
	t.Parallel()
	var writes atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodPut {
			writes.Add(1)
			writer.WriteHeader(http.StatusOK)
			return
		}
		writer.WriteHeader(http.StatusForbidden)
	}))
	t.Cleanup(server.Close)
	_, err := testClient(t, server.URL, "test-token").UpdateTaskComment(
		t.Context(),
		42,
		7,
		TaskCommentWrite{Comment: "saved"},
	)
	if !errors.Is(err, ErrCommentUpdateUnconfirmed) || writes.Load() != 1 {
		t.Fatalf("update confirmation = %v, writes = %d", err, writes.Load())
	}
}

func TestTaskCommentRejectsMismatchedIdentity(t *testing.T) {
	t.Parallel()
	for _, body := range []string{
		`{"id":8,"comment":"body","author":{"id":9}}`,
		`{"id":7,"task_id":41,"comment":"body","author":{"id":9}}`,
	} {
		t.Run(body, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				if request.Method != http.MethodGet || request.URL.Path != "/api/v2/tasks/42/comments/7" {
					t.Errorf("wrong comment path: %s %s", request.Method, request.URL.Path)
				}
				writer.Header().Set("Content-Type", "application/json")
				_, _ = writer.Write([]byte(body))
			}))
			t.Cleanup(server.Close)
			_, err := testClient(t, server.URL, "test-token").TaskComment(t.Context(), 42, 7)
			if !errors.Is(err, ErrRejectedResponse) {
				t.Fatalf("identity mismatch = %v", err)
			}
		})
	}
}

func TestCommentPageAcceptsEmptyPageAfterDeletion(t *testing.T) {
	t.Parallel()
	for _, body := range []string{
		`{"items":[],"page":2,"per_page":1,"total":1,"total_pages":1}`,
		`{"items":[],"page":2,"per_page":1,"total":0,"total_pages":0}`,
	} {
		t.Run(body, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				_, _ = writer.Write([]byte(body))
			}))
			t.Cleanup(server.Close)
			page, err := testClient(t, server.URL, "test-token").TaskComments(
				t.Context(),
				42,
				CommentQuery{Page: 2, PerPage: 1, Order: "asc"},
			)
			if err != nil || page.Page != 2 || len(page.Items) != 0 {
				t.Fatalf("empty page after deletion = %#v, error = %v", page, err)
			}
		})
	}
}

func TestCommentPageStillRejectsInconsistentBounds(t *testing.T) {
	t.Parallel()
	for _, page := range []CommentPage{
		{Page: 1, PerPage: 1, Total: 0, TotalPages: 0},
		{Page: 2, PerPage: 0, Total: 0, TotalPages: 0},
		{Page: 2, PerPage: 2, Total: 0, TotalPages: 0},
		{Page: 2, PerPage: 1, Total: -1, TotalPages: 0},
		{Page: 2, PerPage: 1, Total: 0, TotalPages: 1},
		{Page: 2, PerPage: 1, Total: 1, TotalPages: 2},
		{Page: 2, PerPage: 1, Total: 1, TotalPages: 1, Items: []TaskComment{{ID: 7}}},
		{Page: 2, PerPage: 1, Total: 2, TotalPages: 2},
	} {
		if err := validateCommentPage(page, CommentQuery{Page: 2, PerPage: 1}); !errors.Is(err, ErrRejectedResponse) {
			t.Errorf("inconsistent page accepted: %#v", page)
		}
	}
}
