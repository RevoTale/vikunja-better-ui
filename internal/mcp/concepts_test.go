package mcp

import (
	"strings"
	"testing"
)

func TestConceptIndexWorksWithoutResources(t *testing.T) {
	t.Parallel()
	catalog := newConceptCatalog()
	_, result, err := catalog.explain(t.Context(), nil, conceptInput{Concept: "unknown"})
	if err != nil || result.Concept != "overview" {
		t.Fatalf("unknown concept did not return index: %v", err)
	}
	for name := range catalog {
		if !strings.Contains(result.Explanation, name) {
			t.Errorf("missing discoverable concept %s", name)
		}
	}
}

func TestBoundedTextPreservesUnicodeAndSignalsTruncation(t *testing.T) {
	t.Parallel()
	for _, input := range []string{"", "їж", "їжак", "abcd"} {
		got, truncated := boundedText(input, 2)
		want := []rune(input)
		if len(want) > 2 {
			want = want[:2]
		}
		if got != string(want) || truncated != (len([]rune(input)) > 2) {
			t.Errorf("bad text boundary for %q: %q, %v", input, got, truncated)
		}
	}
}
