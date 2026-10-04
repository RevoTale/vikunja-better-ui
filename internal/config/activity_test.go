package config

import "testing"

func TestPublicActivityRequiresExplicitOptIn(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"", "false", "true", "yes"} {
		t.Run(value, func(t *testing.T) {
			t.Parallel()
			values := validValues()
			values["APP_PUBLIC_ACTIVITY_ENABLED"] = value
			config, err := Load(lookup(values))
			if value == "yes" {
				if err == nil {
					t.Fatal("invalid opt-in accepted")
				}
				return
			}
			if err != nil || config.PublicActivityEnabled != (value == "true") {
				t.Fatalf("config=%+v err=%v", config.PublicActivityEnabled, err)
			}
		})
	}
}
