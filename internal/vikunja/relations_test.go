package vikunja

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRelationTransportUsesV2Routes(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.Method {
		case http.MethodGet:
			if request.URL.Path != "/api/v2/tasks/42" {
				t.Errorf("read path = %s", request.URL.Path)
			}
			_, _ = writer.Write([]byte(`{"id":42,"related_tasks":{"related":[{"id":7,"title":"Other"}]}}`))
		case http.MethodPost:
			var relation TaskRelation
			if err := json.NewDecoder(request.Body).Decode(&relation); err != nil {
				t.Error(err)
			}
			if request.URL.Path != "/api/v2/tasks/42/relations" || relation.OtherTaskID != 7 ||
				relation.RelationKind != RelationRelated {
				t.Errorf("relation request = %s %#v", request.URL.Path, relation)
			}
			_, _ = writer.Write([]byte(`{"task_id":42,"other_task_id":7,"relation_kind":"related"}`))
		case http.MethodDelete:
			if request.URL.Path != "/api/v2/tasks/42/relations/related/7" {
				t.Errorf("delete path = %s", request.URL.Path)
			}
			writer.WriteHeader(http.StatusNoContent)
		default:
			t.Errorf("unexpected method %s", request.Method)
		}
	}))
	t.Cleanup(server.Close)
	client := testClient(t, server.URL, "test-token")
	relations, err := client.TaskRelations(t.Context(), 42)
	if err != nil || len(relations[RelationRelated]) != 1 || relations[RelationRelated][0].ID != 7 {
		t.Fatalf("relations = %#v, error = %v", relations, err)
	}
	if err := client.CreateTaskRelation(t.Context(), 42, 7, RelationRelated); err != nil {
		t.Fatal(err)
	}
	if err := client.DeleteTaskRelation(t.Context(), 42, 7, RelationRelated); err != nil {
		t.Fatal(err)
	}
}
