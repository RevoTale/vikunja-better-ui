package vikunja

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

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
