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
		change     func(map[string]string)
		wantDetail string
	}{
		{
			name: "missing token",
			change: func(values map[string]string) {
				delete(values, "APP_VIKUNJA_API_TOKEN")
			},
			wantDetail: "APP_VIKUNJA_API_TOKEN",
		},
		{
			name: "short secret",
			change: func(values map[string]string) {
				values["APP_SESSION_SECRET"] = base64.StdEncoding.EncodeToString([]byte("too short"))
			},
			wantDetail: "APP_SESSION_SECRET",
		},
		{
			name: "invalid base64 secret",
			change: func(values map[string]string) {
				values["APP_SESSION_SECRET"] = "not base64!"
			},
			wantDetail: "APP_SESSION_SECRET",
		},
		{
			name: "production Vikunja requires https",
			change: func(values map[string]string) {
				values["APP_VIKUNJA_URL"] = "http://vikunja.example.test"
			},
			wantDetail: "HTTPS",
		},
		{
			name: "Vikunja URL rejects credentials",
			change: func(values map[string]string) {
				values["APP_VIKUNJA_URL"] = "https://user:pass@vikunja.example.test"
			},
			wantDetail: "user information",
		},
		{
			name: "Vikunja URL rejects query",
			change: func(values map[string]string) {
				values["APP_VIKUNJA_URL"] = "https://vikunja.example.test?secret=value"
			},
			wantDetail: "query",
		},
		{
			name: "origin rejects path",
			change: func(values map[string]string) {
				values["APP_ALLOWED_ORIGIN"] = "https://tasks.example.test/graphql"
			},
			wantDetail: "origin",
		},
		{
			name: "production origin required",
			change: func(values map[string]string) {
				delete(values, "APP_ALLOWED_ORIGIN")
			},
			wantDetail: "APP_ALLOWED_ORIGIN",
		},
		{
			name: "unknown environment",
			change: func(values map[string]string) {
				values["APP_ENV"] = "staging"
			},
			wantDetail: "APP_ENV",
		},
		{
			name: "unknown log level",
			change: func(values map[string]string) {
				values["APP_LOG_LEVEL"] = "verbose"
			},
			wantDetail: "APP_LOG_LEVEL",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			values := validValues()
			test.change(values)
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
