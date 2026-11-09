package mcp

import (
	"net/http"
	"net/http/httptest"
	"testing"

	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

type fixtureBearerTransport struct{ base http.RoundTripper }

func (transport fixtureBearerTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	copyRequest := request.Clone(request.Context())
	copyRequest.Header.Set("Authorization", "Bearer tk_fixture")
	return transport.base.RoundTrip(copyRequest)
}

func TestSDKClientInitializesAndReadsConceptResource(t *testing.T) {
	t.Parallel()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	defer upstream.Close()
	endpoint := httptest.NewServer(testHandler(t, upstream.URL))
	defer endpoint.Close()
	httpClient := endpoint.Client()
	httpClient.Transport = fixtureBearerTransport{base: httpClient.Transport}
	client := sdk.NewClient(&sdk.Implementation{Name: "contract-fixture", Version: "1"}, nil)
	session, err := client.Connect(t.Context(), &sdk.StreamableClientTransport{
		Endpoint: endpoint.URL, HTTPClient: httpClient, MaxRetries: -1, DisableStandaloneSSE: true}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = session.Close() }()
	tools, err := session.ListTools(t.Context(), nil)
	if err != nil || len(tools.Tools) == 0 {
		t.Fatalf("discovery failed: %v", err)
	}
	resource, err := session.ReadResource(t.Context(), &sdk.ReadResourceParams{URI: "better-ui://concepts/planning"})
	if err != nil || len(resource.Contents) != 1 {
		t.Fatalf("resource read failed: %v", err)
	}
}
