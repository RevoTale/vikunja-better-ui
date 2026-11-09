package mcp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAgendaReportsFailedSectionsInsteadOfEmptySuccess(t *testing.T) {
	t.Parallel()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v2/mcp":
			w.WriteHeader(http.StatusAccepted)
		case "/api/v2/user":
			_, _ = w.Write([]byte(`{"id":1,"username":"fixture","settings":{"timezone":"UTC"}}`))
		case "/api/v2/projects":
			_, _ = w.Write([]byte(`{"items":[],"page":1,"per_page":1000,"total":0,"total_pages":0}`))
		default:
			w.WriteHeader(http.StatusForbidden)
		}
	}))
	defer upstream.Close()
	response := callProtocol(testHandler(t, upstream.URL), "tk_fixture",
		`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_agenda","arguments":{}}}`)
	var body struct {
		Result struct {
			StructuredContent agendaOutput `json:"structuredContent"`
		} `json:"result"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	output := body.Result.StructuredContent
	for _, section := range []agendaSection{output.Obligations, output.AvailableNow, output.Sessions} {
		if section.Complete || section.Issue == "" {
			t.Fatalf("failure masked as complete: %s", response.Body)
		}
	}
	if output.ProjectionsComplete || output.ProjectionsIssue == "" || output.OverlapsComplete {
		t.Fatalf("incomplete projections/overlaps masked: %s", response.Body)
	}
}
