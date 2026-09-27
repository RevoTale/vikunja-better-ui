package vikunja

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTaskListCommentCountExpansion(t *testing.T) {
	t.Parallel()
	for _, include := range []bool{false, true} {
		t.Run(map[bool]string{false: "without", true: "with"}[include], func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				want := ""
				if include {
					want = "comment_count"
				}
				if r.URL.Query().Get("expand") != want {
					t.Errorf("expand = %q", r.URL.Query().Get("expand"))
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"items":[{"id":1,"comment_count":7}],"total":1,"page":1,"per_page":20,"total_pages":1}`))
			}))
			defer server.Close()
			page, err := testClient(t, server.URL, "test-token").TasksPage(t.Context(), TaskQuery{Page: 1, PerPage: 20, IncludeCommentCount: include})
			if err != nil {
				t.Fatal(err)
			}
			if page.Items[0].CommentCount == nil || *page.Items[0].CommentCount != 7 {
				t.Fatal("count was not decoded")
			}
		})
	}
}
