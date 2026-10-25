package resolver

import "testing"

func TestPublicActivityRequiresSessionBeforeReadingUpstream(t *testing.T) {
	t.Parallel()
	result, err := (&queryResolver{New(Dependencies{})}).PublicActivity(t.Context())
	if err == nil || result != nil {
		t.Fatalf("anonymous activity: %v %v", result, err)
	}
}
