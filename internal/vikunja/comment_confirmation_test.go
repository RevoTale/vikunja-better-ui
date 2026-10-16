package vikunja

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestCreateTaskCommentDoesNotRetryUncertainWrites(t *testing.T) {
	t.Parallel()

	var requests atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusInternalServerError)
		_, _ = writer.Write([]byte(`{"message":"Internal Server Error"}`))
	}))
	t.Cleanup(server.Close)
	client := testClient(t, server.URL, "test-token")
	_, err := client.CreateTaskComment(context.Background(), 42, TaskCommentWrite{Comment: "<p>Draft</p>"})
	upstream, ok := errors.AsType[*Error](err)
	if !ok || upstream.Status != http.StatusInternalServerError {
		t.Fatalf("CreateTaskComment() error = %v, want upstream 500", err)
	}
	if count := requests.Load(); count != 1 {
		t.Fatalf("upstream requests = %d, want one write without an automatic retry", count)
	}
}
