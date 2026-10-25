package config

import (
	"strings"
	"testing"
)

func TestApplicationPublicURLIsAnExplicitIndexingOptIn(t *testing.T) {
	t.Parallel()

	values := validValues()
	configuration, err := Load(lookup(values))
	if err != nil {
		t.Fatal(err)
	}
	if configuration.PublicURL != nil {
		t.Fatalf("PublicURL = %s, want nil", configuration.PublicURL)
	}

	values["APP_PUBLIC_URL"] = "https://tasks.example.test/"
	configuration, err = Load(lookup(values))
	if err != nil {
		t.Fatal(err)
	}
	if got := configuration.PublicURL.String(); got != "https://tasks.example.test" {
		t.Fatalf("PublicURL = %q", got)
	}
}

func TestApplicationPublicURLRejectsNonCanonicalOrigins(t *testing.T) {
	t.Parallel()

	for _, value := range []string{
		"http://tasks.example.test",
		"https://user@tasks.example.test",
		"https://tasks.example.test/app",
		"https://tasks.example.test?source=test",
		"https://tasks.example.test#activity",
	} {
		values := validValues()
		values["APP_PUBLIC_URL"] = value
		_, err := Load(lookup(values))
		if err == nil || !strings.Contains(err.Error(), "APP_PUBLIC_URL") || strings.Contains(err.Error(), value) {
			t.Fatalf("unsafe public URL validation = %v", err)
		}
	}
}

func TestApplicationPublicURLAllowsHTTPOnlyForLoopbackDevelopment(t *testing.T) {
	t.Parallel()

	values := validValues()
	values["APP_ENV"] = "development"
	values["APP_PUBLIC_URL"] = "http://127.0.0.1:4180"
	configuration, err := Load(lookup(values))
	if err != nil {
		t.Fatal(err)
	}
	if got := configuration.PublicURL.String(); got != "http://127.0.0.1:4180" {
		t.Fatalf("PublicURL = %q", got)
	}

	values["APP_PUBLIC_URL"] = "http://tasks.example.test"
	if _, err = Load(lookup(values)); err == nil {
		t.Fatal("non-loopback HTTP public URL accepted")
	}
}

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
