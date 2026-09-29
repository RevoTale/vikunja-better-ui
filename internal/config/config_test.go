package config

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestLoadValidProductionConfiguration(t *testing.T) {
	t.Parallel()

	values := validValues()
	configuration, err := Load(lookup(values))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if got := configuration.HTTPAddr; got != ":8080" {
		t.Fatalf("HTTPAddr = %q, want %q", got, ":8080")
	}
	if got := configuration.LogLevel; got != LogLevelInfo {
		t.Fatalf("LogLevel = %q, want %q", got, LogLevelInfo)
	}
	if got := configuration.Environment; got != EnvironmentProduction {
		t.Fatalf("Environment = %q, want %q", got, EnvironmentProduction)
	}
	if got := configuration.VikunjaURL.String(); got != "https://vikunja.example.test" {
		t.Fatalf("VikunjaURL = %q", got)
	}
	if got := configuration.AllowedOrigin.String(); got != "https://tasks.example.test" {
		t.Fatalf("AllowedOrigin = %q", got)
	}
	if len(configuration.SessionSecret) != 32 {
		t.Fatalf("len(SessionSecret) = %d, want 32", len(configuration.SessionSecret))
	}
}

func TestLoadRejectsInvalidConfiguration(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		key        string
		value      string
		wantDetail string
	}{
		{"missing token", "APP_VIKUNJA_API_TOKEN", "", "APP_VIKUNJA_API_TOKEN"},
		{"short secret", "APP_SESSION_SECRET", base64.StdEncoding.EncodeToString([]byte("short")), "APP_SESSION_SECRET"},
		{"invalid base64 secret", "APP_SESSION_SECRET", "not base64!", "APP_SESSION_SECRET"},
		{"production Vikunja requires https", "APP_VIKUNJA_URL", "http://vikunja.example.test", "HTTPS"},
		{"Vikunja URL rejects credentials", "APP_VIKUNJA_URL", "https://user:pass@vikunja.example.test", "user information"},
		{"Vikunja URL rejects query", "APP_VIKUNJA_URL", "https://vikunja.example.test?secret=value", "query"},
		{"origin rejects path", "APP_ALLOWED_ORIGIN", "https://tasks.example.test/graphql", "origin"},
		{"production origin required", "APP_ALLOWED_ORIGIN", "", "APP_ALLOWED_ORIGIN"},
		{"unknown environment", "APP_ENV", "staging", "APP_ENV"},
		{"unknown log level", "APP_LOG_LEVEL", "verbose", "APP_LOG_LEVEL"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			values := validValues()
			if test.value == "" {
				delete(values, test.key)
			} else {
				values[test.key] = test.value
			}
			_, err := Load(lookup(values))
			if err == nil {
				t.Fatal("Load() error = nil, want error")
			}
			if !strings.Contains(err.Error(), test.wantDetail) {
				t.Fatalf("Load() error = %q, want detail %q", err, test.wantDetail)
			}
		})
	}
}

func TestLoadAllowsLocalHTTPAndDefaultOrigin(t *testing.T) {
	t.Parallel()

	values := validValues()
	values["APP_ENV"] = "development"
	values["APP_VIKUNJA_URL"] = "http://127.0.0.1:3456/"
	delete(values, "APP_ALLOWED_ORIGIN")

	configuration, err := Load(lookup(values))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if got := configuration.AllowedOrigin.String(); got != "http://localhost:5173" {
		t.Fatalf("AllowedOrigin = %q, want local Vite origin", got)
	}
	if got := configuration.VikunjaURL.String(); got != "http://127.0.0.1:3456" {
		t.Fatalf("VikunjaURL = %q, want normalized URL", got)
	}
}

func validValues() map[string]string {
	return map[string]string{
		"APP_VIKUNJA_URL":       "https://vikunja.example.test/",
		"APP_VIKUNJA_API_TOKEN": "test-token-placeholder",
		"APP_AUTH_USERNAME":     "test-user",
		"APP_AUTH_PASSWORD":     "test-password-placeholder",
		"APP_SESSION_SECRET":    base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")),
		"APP_ALLOWED_ORIGIN":    "https://tasks.example.test",
	}
}

func lookup(values map[string]string) LookupFunc {
	return func(name string) (string, bool) {
		value, ok := values[name]
		return value, ok
	}
}
