package vikunja

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRelationReadRejectsInconsistentIdentities(t *testing.T) {
	t.Parallel()
	for _, body := range []string{
		`{"id":99}`, `{"id":42,"related_tasks":{"related":[{"id":42}]}}`,
		`{"id":42,"related_tasks":{"related":[{"id":0}]}}`,
	} {
		t.Run(body, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				_, _ = writer.Write([]byte(body))
			}))
			t.Cleanup(server.Close)
			_, err := testClient(t, server.URL, "test-token").TaskRelations(t.Context(), 42)
			if !errors.Is(err, ErrRejectedResponse) {
				t.Fatalf("read error = %v", err)
			}
		})
	}
}

func TestRelationValidationNeverSendsUnsafeIdentifiers(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Error("invalid relation reached upstream")
	}))
	t.Cleanup(server.Close)
	client := testClient(t, server.URL, "test-token")
	for _, testCase := range []TaskRelation{
		{TaskID: 0, OtherTaskID: 2, RelationKind: RelationRelated},
		{TaskID: 1, OtherTaskID: 1, RelationKind: RelationChild},
		{TaskID: 1, OtherTaskID: 2, RelationKind: "../attachments"},
	} {
		err := client.CreateTaskRelation(t.Context(), testCase.TaskID, testCase.OtherTaskID, testCase.RelationKind)
		if err == nil {
			t.Fatal("unsafe creation accepted")
		}
		err = client.DeleteTaskRelation(t.Context(), testCase.TaskID, testCase.OtherTaskID, testCase.RelationKind)
		if err == nil {
			t.Fatal("unsafe deletion accepted")
		}
	}
}
