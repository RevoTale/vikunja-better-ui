package resolver

import (
	"context"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/generated"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestSkipSchemaRequiresExpectedOccurrence(t *testing.T) {
	t.Parallel()
	schema := generated.NewExecutableSchema(generated.Config{}).Schema()
	input := schema.Types["SkipRecurringTaskInput"]
	if input == nil {
		t.Fatal("missing Skip input")
	}
	field := input.Fields.ForName("expectedDueAt")
	if field == nil || field.Type.String() != "DateTime!" {
		t.Fatal("Skip must require an expected due instant")
	}
}

func TestSkipStaleOccurrenceReturnsConflict(t *testing.T) {
	t.Parallel()
	client := &taskActionClientStub{task: vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Repeat", RepeatAfter: 86400,
		DueDate: time.Date(2026, time.August, 1, 12, 0, 0, 0, time.UTC),
	}}
	root, sessions, session, cookie := taskActionResolver(t, client)
	withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
		_, err := (&mutationResolver{root}).SkipRecurringTask(ctx, model.SkipRecurringTaskInput{
			CsrfToken: sessions.CSRFToken(session), TaskID: "9", ExpectedDueAt: client.task.DueDate.Add(-time.Hour),
		})
		assertErrorCode(t, err, "CONFLICT")
	})
}
