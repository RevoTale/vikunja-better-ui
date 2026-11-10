package config

import (
	"strings"
	"testing"
)

func TestMCPFallbackTimezone(t *testing.T) {
	t.Parallel()
	for _, zone := range []string{"", "Europe/Kyiv", "UTC", "Local", "invalid/zone", " Europe/Kyiv"} {
		t.Run(zone, func(t *testing.T) {
			t.Parallel()
			values := validValues()
			values["APP_MCP_FALLBACK_TIMEZONE"] = zone
			configuration, err := Load(lookup(values))
			valid := zone == "" || zone == "Europe/Kyiv" || zone == "UTC"
			if !valid {
				if err == nil || !strings.Contains(err.Error(), "APP_MCP_FALLBACK_TIMEZONE") {
					t.Fatalf("invalid timezone accepted or unsafe error: %v", err)
				}
				return
			}
			if err != nil || configuration.MCPFallbackTimezone != zone {
				t.Fatalf("fallback timezone mismatch: %q, %v", configuration.MCPFallbackTimezone, err)
			}
		})
	}
}

func TestMCPIsExplicitlyEnabled(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"", "false", "true", "invalid"} {
		t.Run(value, func(t *testing.T) {
			t.Parallel()
			values := validValues()
			values["APP_MCP_ENABLED"] = value
			configuration, err := Load(lookup(values))
			if value == "invalid" {
				if err == nil {
					t.Fatal("invalid feature flag accepted")
				}
				return
			}
			if err != nil || configuration.MCPEnabled != (value == "true") {
				t.Fatalf("MCP opt-in mismatch: %v", err)
			}
		})
	}
}
