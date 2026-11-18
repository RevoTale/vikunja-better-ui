package config

import "testing"

func TestPrivateLoginNeedsNoAppCredentials(t *testing.T) {
	t.Parallel()
	values := validValues()
	delete(values, "APP_VIKUNJA_API_TOKEN")
	delete(values, "APP_ALLOWED_ORIGIN")
	c, err := Load(lookup(values))
	if err != nil || c.AllowedOrigin != nil || c.VikunjaAPIToken != "" {
		t.Fatal("private installation should start with just the upstream URL and the session secret", err)
	}
	for _, key := range []string{"APP_PUBLIC_ACTIVITY_ENABLED", "PUBLIC_ALL_TIME_ACTIVITY"} {
		values[key] = "true"
		if _, loadErr := Load(lookup(values)); loadErr == nil {
			t.Fatalf("anonymous aggregate %s accepted without a token", key)
		}
		delete(values, key)
	}
}

func TestProductionOriginSupportsPrivateHTTP(t *testing.T) {
	t.Parallel()
	for input, want := range map[string]string{
		"http://[fd00:0000:0:0:0:0:0:20]:08080": "http://[fd00::20]:8080",
		"http://10.77.0.20:8080":                "http://10.77.0.20:8080",
		"http://[fd00::20]:80":                  "http://[fd00::20]",
		"https://Tasks.Example:443":             "https://tasks.example",
	} {
		values := validValues()
		values["APP_ALLOWED_ORIGIN"] = input
		c, err := Load(lookup(values))
		if err != nil || c.AllowedOrigin.String() != want {
			t.Errorf("origin %s: want %s, got %v (%v)", input, want, c.AllowedOrigin, err)
		}
	}
}

func TestOriginFallbackMatchesBrowserAndRejectsMalformedAddresses(t *testing.T) {
	t.Parallel()
	values := validValues()
	delete(values, "APP_ALLOWED_ORIGIN")
	values["APP_PUBLIC_URL"] = "https://[fd00:0:0:0:0:0:0:20]:00443/"
	c, err := Load(lookup(values))
	if err != nil || c.AllowedOrigin == nil || c.AllowedOrigin.String() != "https://[fd00::20]" {
		t.Fatal("canonical fallback must match a browser's serialized Origin")
	}
	for _, key := range []string{"APP_ALLOWED_ORIGIN", "APP_PUBLIC_URL"} {
		for _, bad := range []string{
			"https://tasks.test:", "https://tasks.test:99999", "https://tasks.test?", "https://tasks.test#",
		} {
			copyValues := validValues()
			copyValues[key] = bad
			if _, loadErr := Load(lookup(copyValues)); loadErr == nil {
				t.Errorf("%s accepted %q", key, bad)
			}
		}
	}
}
