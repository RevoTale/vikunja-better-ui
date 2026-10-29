package config

import "testing"

func TestProductionAllowsHTTPTransportWithPublicHTTPSURL(t *testing.T) {
	t.Parallel()
	values := validValues()
	values["APP_VIKUNJA_URL"] = "http://vikunja:3456/internal/"
	values["APP_VIKUNJA_PUBLIC_URL"] = "https://vikunja.example.test/public/"
	configuration, err := Load(lookup(values))
	if err != nil {
		t.Fatal(err)
	}
	if configuration.VikunjaURL.String() != "http://vikunja:3456/internal" ||
		configuration.VikunjaPublicURL.String() != "https://vikunja.example.test/public" ||
		configuration.Environment != EnvironmentProduction {
		t.Fatal("transport and public URLs must remain separate in production")
	}
}
