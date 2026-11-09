package config

import "testing"

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
