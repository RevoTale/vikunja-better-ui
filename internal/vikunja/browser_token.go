package vikunja

import (
	"context"
	"errors"
	"net/http"
)

// ErrTokenCheckUnavailable means Vikunja denied an operation and its independent
// validity check could not determine whether the personal credential is still valid.
var ErrTokenCheckUnavailable = errors.New("upstream token validity could not be checked")

// ForBrowserToken scopes private requests and ambiguous 401 verification to one browser operation.
func (client *Client) ForBrowserToken(token string) *Client {
	scoped := client.ForToken(token)
	if token != "" {
		scoped.browserTokenChecks = &inflightGroup[bool]{}
	}
	return scoped
}

// Vikunja 2.8 returns the same 401 when a token is invalid or lacks the route scope.
// Only a rejected browser operation needs the separate scope-independent GET. Never retry the original request.
func (client *Client) send(request *http.Request) (*http.Response, error) {
	response, err := client.httpClient.Do(request)
	if err != nil || response.StatusCode != http.StatusUnauthorized || client.browserTokenChecks == nil {
		return response, err
	}
	_ = response.Body.Close()
	valid, err := client.browserTokenChecks.do(request.Context(), client.checkBrowserToken)
	if err != nil {
		return nil, err
	}
	status := http.StatusUnauthorized
	if valid {
		status = http.StatusForbidden
	}
	return nil, &Error{Status: status, Code: upstreamRejected}
}

func (client *Client) checkBrowserToken(ctx context.Context) (bool, error) {
	const path = "token/test"
	request, err := client.newJSONRequest(ctx, http.MethodGet, path, nil, nil, "", "")
	if err != nil {
		return false, ErrTokenCheckUnavailable
	}
	// Send the probe directly so a 401 from this endpoint can never trigger another probe.
	response, err := client.httpClient.Do(request)
	if err != nil {
		return false, ErrTokenCheckUnavailable
	}
	defer func() { _ = response.Body.Close() }()
	switch response.StatusCode {
	case http.StatusUnauthorized:
		return false, nil
	case http.StatusOK:
		var body struct {
			Message string `json:"message"`
		}
		if _, decodeErr := decodeJSONResponse(response, &body); decodeErr == nil && body.Message == "ok" {
			return true, nil
		}
	}
	return false, ErrTokenCheckUnavailable
}
