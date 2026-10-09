package config

import "testing"

func TestTimeFormatConfiguration(t *testing.T) {
	t.Parallel()

	for _, value := range []string{"", "24h", "12h", "invalid"} {
		t.Run(value, func(t *testing.T) {
			t.Parallel()

			values := validValues()
			values["APP_TIME_FORMAT"] = value
			configuration, err := Load(lookup(values))
			if value == "invalid" {
				if err == nil {
					t.Fatal("invalid clock format accepted")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if configuration.Use12HourTime != (value == "12h") {
				t.Fatalf("incorrect clock format for %q", value)
			}
		})
	}
}
