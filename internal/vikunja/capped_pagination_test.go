package vikunja

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

func TestClientAcceptsInstancePaginationCap(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		pageNumber, err := strconv.Atoi(request.URL.Query().Get("page"))
		if err != nil {
			http.Error(writer, "invalid page", http.StatusBadRequest)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(writer,
			`{"items":[{"id":%d,"title":"Item"}],"total":2,"page":%d,"per_page":1,"total_pages":2}`,
			pageNumber, pageNumber,
		)
	}))
	t.Cleanup(server.Close)
	client := testClient(t, server.URL, "test-token")
	ctx := context.Background()
	projects, err := client.Projects(ctx)
	if err != nil || len(projects) != 2 || projects[1].ID != 2 {
		t.Fatalf("Projects() = %v, %v", projects, err)
	}
	labels, err := client.Labels(ctx)
	if err != nil || len(labels) != 2 || labels[1].ID != 2 {
		t.Fatalf("Labels() = %v, %v", labels, err)
	}
	query := TaskQuery{Page: 2, PerPage: 100}
	tasks, err := client.TasksPage(ctx, query)
	if err != nil || tasks.PerPage != 1 || len(tasks.Items) != 1 || tasks.Items[0].ID != 2 {
		t.Fatalf("TasksPage() = %v, %v", tasks, err)
	}
	activity, err := client.ActivityPage(ctx, query)
	if err != nil || activity.PerPage != 1 || len(activity.Items) != 1 {
		t.Fatalf("ActivityPage() = %v, %v", activity, err)
	}
}

func TestValidatePageRejectsInvalidCaps(t *testing.T) {
	t.Parallel()
	for _, perPage := range []int64{-1, 0, 101} {
		if err := validatePage(1, perPage, 0, 0, 1, 100); err == nil {
			t.Errorf("validatePage(perPage=%d) accepted an invalid cap", perPage)
		}
	}
}

func TestClientRejectsChangedMetadataPageCap(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Query().Get("page") == "1" {
			_, _ = writer.Write([]byte(`{"items":[{"id":1},{"id":2}],"total":4,"page":1,"per_page":2,"total_pages":2}`))
			return
		}
		_, _ = writer.Write([]byte(`{"items":[{"id":4}],"total":4,"page":2,"per_page":3,"total_pages":2}`))
	}))
	t.Cleanup(server.Close)
	client := testClient(t, server.URL, "test-token")
	if _, err := client.Projects(t.Context()); !errors.Is(err, ErrRejectedResponse) {
		t.Fatalf("Projects() with changed cap = %v", err)
	}
	if _, err := client.Labels(t.Context()); !errors.Is(err, ErrRejectedResponse) {
		t.Fatalf("Labels() with changed cap = %v", err)
	}
}
