// Package vikunja provides bounded, authenticated access to the Vikunja REST API.
package vikunja

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	apiVersionPath            = "api/v2"
	maxResponseBodyBytes      = 4 << 20
	userAgent                 = "vikunja-better-ui"
	slowRequestThreshold      = 500 * time.Millisecond
	upstreamRejected          = "UPSTREAM_REJECTED"
	requestTimeout            = 30 * time.Second
	connectTimeout            = 5 * time.Second
	keepAliveInterval         = 30 * time.Second
	maxIdleConnections        = 32
	maxIdleConnectionsPerHost = 8
	idleConnectionTimeout     = 90 * time.Second
	responseHeaderTimeout     = 10 * time.Second
)

// Client owns upstream credentials and coalesces only concurrent metadata reads.
type Client struct {
	baseURL             *url.URL
	apiToken            string
	httpClient          *http.Client
	logger              *slog.Logger
	currentUserRequests inflightGroup[User]
	projectRequests     inflightGroup[[]Project]
	labelRequests       inflightGroup[[]Label]
}

// Option customizes client construction without exposing its credentials.
type Option func(*Client)

// WithLogger enables safe upstream timing diagnostics.
func WithLogger(logger *slog.Logger) Option {
	return func(client *Client) {
		client.logger = logger
	}
}

// ResponseMetadata carries the upstream concurrency token for conditional writes.
type ResponseMetadata struct {
	ETag string
}

// Error exposes status and a safe classification, never the upstream response body.
type Error struct {
	Status int
	Code   string
}

func (err *Error) Error() string {
	return fmt.Sprintf("Vikunja request failed with status %d", err.Status)
}

// NewClient creates a timeout-bounded client that never follows redirects with credentials.
func NewClient(baseURL *url.URL, apiToken string, options ...Option) *Client {
	clonedURL := *baseURL
	client := &Client{
		baseURL:  &clonedURL,
		apiToken: apiToken,
		httpClient: &http.Client{
			Timeout: requestTimeout,
			Transport: &http.Transport{
				Proxy: http.ProxyFromEnvironment,
				DialContext: (&net.Dialer{
					Timeout:   connectTimeout,
					KeepAlive: keepAliveInterval,
				}).DialContext,
				ForceAttemptHTTP2:     true,
				MaxIdleConns:          maxIdleConnections,
				MaxIdleConnsPerHost:   maxIdleConnectionsPerHost,
				IdleConnTimeout:       idleConnectionTimeout,
				TLSHandshakeTimeout:   connectTimeout,
				ResponseHeaderTimeout: responseHeaderTimeout,
				ExpectContinueTimeout: time.Second,
			},
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
	for _, option := range options {
		option(client)
	}
	return client
}

// CloseIdleConnections releases connections held by a short-lived client.
func (client *Client) CloseIdleConnections() {
	client.httpClient.CloseIdleConnections()
}

func (client *Client) doJSON(
	ctx context.Context,
	method string,
	path string,
	input any,
	ifMatch string,
	output any,
) (ResponseMetadata, error) {
	return client.doJSONWithQuery(ctx, method, path, nil, input, ifMatch, output)
}

func (client *Client) doJSONWithQuery(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	input any,
	ifMatch string,
	output any,
) (ResponseMetadata, error) {
	return client.doJSONWithQueryAndContentType(ctx, method, path, query, input, ifMatch, "application/json", output)
}

func (client *Client) doJSONWithQueryAndContentType(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	input any,
	ifMatch string,
	contentType string,
	output any,
) (metadata ResponseMetadata, requestErr error) {
	startedAt := time.Now()
	defer func() {
		client.logRequest(ctx, method, path, time.Since(startedAt), requestErr)
	}()

	request, err := client.newJSONRequest(ctx, method, path, query, input, ifMatch, contentType)
	if err != nil {
		return ResponseMetadata{}, err
	}

	response, err := client.httpClient.Do(request)
	if err != nil {
		return ResponseMetadata{}, fmt.Errorf("perform Vikunja request: %w", err)
	}
	defer func() {
		_ = response.Body.Close()
	}()

	return decodeJSONResponse(response, output)
}

func (client *Client) newJSONRequest(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	input any,
	ifMatch string,
	contentType string,
) (*http.Request, error) {
	requestURL, err := url.JoinPath(client.baseURL.String(), apiVersionPath, path)
	if err != nil {
		return nil, fmt.Errorf("build Vikunja request URL: %w", err)
	}
	body, err := encodeRequestBody(input)
	if err != nil {
		return nil, err
	}
	parsedRequestURL, err := url.Parse(requestURL)
	if err != nil {
		return nil, fmt.Errorf("parse Vikunja request URL: %w", err)
	}
	parsedRequestURL.RawQuery = query.Encode()
	request, err := http.NewRequestWithContext(ctx, method, parsedRequestURL.String(), body)
	if err != nil {
		return nil, fmt.Errorf("build Vikunja request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "Bearer "+client.apiToken)
	request.Header.Set("User-Agent", userAgent)
	if input != nil {
		request.Header.Set("Content-Type", contentType)
	}
	if ifMatch != "" {
		request.Header.Set("If-Match", ifMatch)
	}
	return request, nil
}

func decodeJSONResponse(response *http.Response, output any) (ResponseMetadata, error) {
	metadata := ResponseMetadata{ETag: response.Header.Get("ETag")}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxResponseBodyBytes+1))
		return metadata, &Error{Status: response.StatusCode, Code: upstreamRejected}
	}
	if response.StatusCode == http.StatusNoContent || output == nil {
		return metadata, nil
	}
	if !isJSONContentType(response.Header.Get("Content-Type")) {
		return metadata, &Error{Status: response.StatusCode, Code: upstreamRejected}
	}

	limitedBody := &io.LimitedReader{R: response.Body, N: maxResponseBodyBytes + 1}
	decoder := json.NewDecoder(limitedBody)
	if err := decoder.Decode(output); err != nil {
		return metadata, &Error{Status: response.StatusCode, Code: upstreamRejected}
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return metadata, &Error{Status: response.StatusCode, Code: upstreamRejected}
	}
	if limitedBody.N == 0 {
		return metadata, &Error{Status: response.StatusCode, Code: upstreamRejected}
	}

	return metadata, nil
}

func (client *Client) logRequest(
	ctx context.Context,
	method string,
	path string,
	duration time.Duration,
	err error,
) {
	if client.logger == nil {
		return
	}
	level := slog.LevelDebug
	if err != nil || duration >= slowRequestThreshold {
		level = slog.LevelWarn
	}
	resource, _, _ := strings.Cut(strings.Trim(path, "/"), "/")
	client.logger.Log(
		ctx, level, "Vikunja request completed",
		"method", method,
		"resource", resource,
		"duration_ms", duration.Milliseconds(),
		"failed", err != nil,
	)
}

func encodeRequestBody(input any) (io.Reader, error) {
	if input == nil {
		return nil, nil
	}
	body, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("encode Vikunja request: %w", err)
	}
	return bytes.NewReader(body), nil
}

func isJSONContentType(value string) bool {
	mediaType, _, err := mime.ParseMediaType(value)
	if err != nil {
		return false
	}
	return mediaType == "application/json" || strings.HasSuffix(mediaType, "+json")
}
