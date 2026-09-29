package vikunja

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientLabelRoundTrip(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(labelRoundTripHandler(t))
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

func labelRoundTripHandler(t *testing.T) http.HandlerFunc {
	t.Helper()
	return func(writer http.ResponseWriter, request *http.Request) {
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
	}
}
