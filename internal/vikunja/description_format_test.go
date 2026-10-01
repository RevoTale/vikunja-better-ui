package vikunja

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreationDescriptionFormatIsExplicitAndBackwardCompatible(t *testing.T) {
	t.Parallel()
	for _, html := range []bool{false, true} {
		server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if (request.URL.Query().Get("format") == "markdown") == html {
				t.Errorf("HTML=%v query=%s", html, request.URL.RawQuery)
			}
			var body map[string]json.RawMessage
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				t.Error(err)
			}
			if _, exists := body["DescriptionHTML"]; exists {
				t.Error("transport option leaked into upstream payload")
			}
			writer.Header().Set("Content-Type", "application/json")
			if err := json.NewEncoder(writer).Encode(Task{ID: 3, Description: "<strong>Keep</strong>"}); err != nil {
				t.Error(err)
			}
		}))
		client := testClient(t, server.URL, "test-token")
		_, err := client.CreateTask(t.Context(), 1, TaskWrite{Title: "Task", DescriptionHTML: html})
		server.Close()
		if err != nil {
			t.Fatal(err)
		}
	}
}
