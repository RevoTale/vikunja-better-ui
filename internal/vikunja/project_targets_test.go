package vikunja

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

func TestClientProjectsCountsOnlyPersistedProjectsOnEveryPage(t *testing.T) {
	t.Parallel()
	const filter = "My Open Tasks"
	for _, tc := range []struct {
		name string
		real []Project
	}{
		{"only virtual projects", []Project{}},
		{"new account", []Project{{ID: 5, Title: "Inbox"}}},
		{"virtual projects recur on each page", []Project{{ID: 5, Title: "Inbox"}, {ID: 8, Title: "Shared"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				number := int64(1)
				if r.URL.Query().Get("page") == "2" {
					number = 2
				}
				items := []Project{{ID: -2, Title: filter}, {ID: -1, Title: "Favorites"}}
				if number <= int64(len(tc.real)) {
					items = append(items, tc.real[number-1])
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(page[Project]{
					Items: items, Page: number, PerPage: 1, Total: int64(len(tc.real)), TotalPages: int64(len(tc.real)),
				})
			}))
			t.Cleanup(server.Close)
			projects, err := testClient(t, server.URL, "test-token").Projects(t.Context())
			if err != nil || !slices.Equal(projects, tc.real) {
				t.Fatalf("Projects() = %+v, %v; want %+v", projects, err, tc.real)
			}
		})
	}
}

func TestClientProjectsKeepsPaginationAndProjectIDValidation(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name  string
		items []Project
		total int64
	}{
		{"missing real project", []Project{{ID: -2, Title: "My Open Tasks"}}, 1},
		{"extra real project", []Project{{ID: 1}, {ID: 2}, {ID: -2, Title: "My Open Tasks"}}, 1},
		{"missing project ID", []Project{{ID: 0}}, 1},
		{"missing saved filter title", []Project{{ID: -2}}, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(page[Project]{
					Items: tc.items, Page: 1, PerPage: 1, Total: tc.total, TotalPages: tc.total,
				})
			}))
			t.Cleanup(server.Close)
			_, err := testClient(t, server.URL, "test-token").Projects(t.Context())
			if !errors.Is(err, ErrRejectedResponse) {
				t.Errorf("Projects() error = %v", err)
			}
		})
	}
}
