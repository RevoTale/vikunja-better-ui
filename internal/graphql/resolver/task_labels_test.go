package resolver

import "testing"

func TestTaskLabelOperationsRequireAuthentication(t *testing.T) {
	t.Parallel()
	query := &queryResolver{Resolver: &Resolver{}}
	if _, err := query.TaskLabels(t.Context()); err == nil {
		t.Fatal("unauthenticated query accepted")
	}
	mutation := &mutationResolver{Resolver: &Resolver{}}
	if _, err := mutation.CreateTaskLabel(t.Context(), "", "work"); err == nil {
		t.Fatal("unauthenticated mutation accepted")
	}
}

func TestParseLabelIDsPreservesOmittedVersusClear(t *testing.T) {
	t.Parallel()
	omitted, err := parseLabelIDs(nil)
	if err != nil || omitted != nil {
		t.Fatalf("omitted=%v err=%v", omitted, err)
	}
	cleared, err := parseLabelIDs([]string{})
	if err != nil || cleared == nil || len(cleared) != 0 {
		t.Fatalf("clear=%v err=%v", cleared, err)
	}
	for _, id := range []string{"0", "-1", "1 && done=true", "9223372036854775808"} {
		if _, err := parseLabelIDs([]string{id}); err == nil {
			t.Fatalf("accepted %q", id)
		}
	}
}
