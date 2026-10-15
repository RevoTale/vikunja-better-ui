package config

import "testing"

func TestAllTimeActivityIndependentOptIn(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"", "false", "true", "yes"} {
		t.Run(value, func(t *testing.T) {
			t.Parallel()
			values := validValues()
			values["PUBLIC_ALL_TIME_ACTIVITY"] = value
			configuration, err := Load(lookup(values))
			if value == "yes" {
				if err == nil {
					t.Fatal("invalid boolean accepted")
				}
				return
			}
			if err != nil || configuration.PublicAllTimeActivityEnabled != (value == "true") ||
				configuration.PublicActivityEnabled {
				t.Fatalf("independent opt-in failed: %v", err)
			}
		})
	}
}
