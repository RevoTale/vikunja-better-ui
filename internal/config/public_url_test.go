package config

import (
	"strings"
	"testing"
)

func TestPublicVikunjaURLUsesValidatedExplicitOriginOrFallback(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"", "https://public.example/vikunja/"} {
		values := validValues()
		values["APP_VIKUNJA_PUBLIC_URL"] = value
		configuration, err := Load(lookup(values))
		if err != nil {
			t.Fatal(err)
		}
		want := strings.TrimSuffix(value, "/")
		if value == "" {
			want = configuration.VikunjaURL.String()
		}
		if configuration.VikunjaPublicURL.String() != want {
			t.Fatalf("public URL = %s, want %s", configuration.VikunjaPublicURL, want)
		}
	}
}

func TestPublicVikunjaURLRejectsUnsafeValuesWithoutExposingThem(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"http://public.example", "https://secret@public.example", "//public.example"} {
		values := validValues()
		values["APP_VIKUNJA_PUBLIC_URL"] = value
		_, err := Load(lookup(values))
		if err == nil || !strings.Contains(err.Error(), "APP_VIKUNJA_PUBLIC_URL") || strings.Contains(err.Error(), value) {
			t.Fatalf("unsafe public URL validation = %v", err)
		}
	}
}
