package resolver

import (
	"context"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/generated"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
)

func TestDescriptionFormatDefaultsRemainMarkdown(t *testing.T) {
	t.Parallel()
	schema := generated.NewExecutableSchema(generated.Config{}).Schema()
	for _, name := range []string{"CreateOneTimeTaskInput", "CreateRecurringTaskInput", "CreateJobInput"} {
		field := schema.Types[name].Fields.ForName("descriptionFormat")
		if field == nil || field.DefaultValue == nil || field.DefaultValue.Raw != "MARKDOWN" {
			t.Fatalf("%s must preserve default Markdown behavior", name)
		}
	}
	for name, want := range map[string]string{"updateTask": "Task!", "updateTaskComment": "TaskComment!"} {
		if field := schema.Mutation.Fields.ForName(name); field == nil || field.Type.String() != want {
			t.Fatalf("%s changed its existing return contract", name)
		}
	}
}

func TestReferenceRepairRequiresAuthenticatedCSRFBeforeReading(t *testing.T) {
	t.Parallel()
	resolver := &mutationResolver{&Resolver{}}
	_, err := resolver.RepairTaskReferences(context.Background(), model.RepairTaskReferencesInput{
		TaskID: "1", TargetIds: []string{"2"},
	})
	assertErrorCode(t, err, "UNAUTHENTICATED")
}

func TestReferenceTargetsRejectInvalidAndUnboundedInput(t *testing.T) {
	t.Parallel()
	for _, ids := range [][]string{nil, {"0"}, {"bad"}, make([]string, 21)} {
		if _, err := parseReferenceIDs(ids); err == nil {
			t.Fatalf("accepted invalid targets %v", ids)
		}
	}
}
