package resolver

import "testing"

func TestPublicActivityDisabledDoesNotReadUpstream(t *testing.T) {
	t.Parallel()
	result, err := (&queryResolver{New(Dependencies{})}).PublicActivity(t.Context())
	if err != nil || result != nil {
		t.Fatalf("disabled activity: %v %v", result, err)
	}
}
