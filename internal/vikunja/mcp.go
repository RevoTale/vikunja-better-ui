package vikunja

import (
	"context"
	"net/http"
)

// CheckMCPAccess validates the token and native mcp:access permission without reading task data.
// The stateless native server acknowledges this notification without a persistent session.
func (client *Client) CheckMCPAccess(ctx context.Context) error {
	input := struct {
		JSONRPC string `json:"jsonrpc"`
		Method  string `json:"method"`
	}{JSONRPC: "2.0", Method: "notifications/initialized"}
	request, err := client.newJSONRequest(ctx, http.MethodPost, "mcp", nil, input, "", "application/json")
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json, text/event-stream")
	request.Header.Set("Mcp-Protocol-Version", "2025-11-25")
	response, err := client.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusAccepted {
		return &Error{Status: response.StatusCode, Code: upstreamRejected}
	}
	return nil
}
