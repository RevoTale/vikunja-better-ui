package vikunja

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	apiVersionPath       = "api/v2"
	maxResponseBodyBytes = 4 << 20
	userAgent            = "vikunja-better-ui"
)

type Client struct {
	baseURL    *url.URL
	apiToken   string
	httpClient *http.Client
}

type ResponseMetadata struct {
	ETag string
}

type Error struct {
	Status int
	Code   string
}

func (err *Error) Error() string {
	return fmt.Sprintf("Vikunja request failed with status %d", err.Status)
}

func NewClient(baseURL *url.URL, apiToken string) *Client {
	clonedURL := *baseURL
	return &Client{
		baseURL:  &clonedURL,
		apiToken: apiToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				Proxy: http.ProxyFromEnvironment,
				DialContext: (&net.Dialer{
					Timeout:   5 * time.Second,
					KeepAlive: 30 * time.Second,
				}).DialContext,
				ForceAttemptHTTP2:     true,
				MaxIdleConns:          32,
				MaxIdleConnsPerHost:   8,
				IdleConnTimeout:       90 * time.Second,
				TLSHandshakeTimeout:   5 * time.Second,
				ResponseHeaderTimeout: 10 * time.Second,
				ExpectContinueTimeout: time.Second,
			},
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
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
) (ResponseMetadata, error) {
	requestURL, err := url.JoinPath(client.baseURL.String(), apiVersionPath, path)
	if err != nil {
		return ResponseMetadata{}, fmt.Errorf("build Vikunja request URL: %w", err)
	}

	body, err := encodeRequestBody(input)
	if err != nil {
		return ResponseMetadata{}, err
	}
	parsedRequestURL, err := url.Parse(requestURL)
	if err != nil {
		return ResponseMetadata{}, fmt.Errorf("parse Vikunja request URL: %w", err)
	}
	parsedRequestURL.RawQuery = query.Encode()

	request, err := http.NewRequestWithContext(ctx, method, parsedRequestURL.String(), body)
	if err != nil {
		return ResponseMetadata{}, fmt.Errorf("build Vikunja request: %w", err)
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

	response, err := client.httpClient.Do(request)
	if err != nil {
		return ResponseMetadata{}, fmt.Errorf("perform Vikunja request: %w", err)
	}
	defer func() {
		_ = response.Body.Close()
	}()

	metadata := ResponseMetadata{ETag: response.Header.Get("ETag")}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxResponseBodyBytes+1))
		return metadata, &Error{Status: response.StatusCode, Code: "UPSTREAM_REJECTED"}
	}
	if response.StatusCode == http.StatusNoContent || output == nil {
		return metadata, nil
	}
	if !isJSONContentType(response.Header.Get("Content-Type")) {
		return metadata, &Error{Status: response.StatusCode, Code: "UPSTREAM_REJECTED"}
	}

	limitedBody := io.LimitReader(response.Body, maxResponseBodyBytes+1)
	responseBytes, err := io.ReadAll(limitedBody)
	if err != nil {
		return metadata, fmt.Errorf("read Vikunja response: %w", err)
	}
	if len(responseBytes) > maxResponseBodyBytes {
		return metadata, &Error{Status: response.StatusCode, Code: "UPSTREAM_REJECTED"}
	}
	decoder := json.NewDecoder(bytes.NewReader(responseBytes))
	if err := decoder.Decode(output); err != nil {
		return metadata, &Error{Status: response.StatusCode, Code: "UPSTREAM_REJECTED"}
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return metadata, &Error{Status: response.StatusCode, Code: "UPSTREAM_REJECTED"}
	}

	return metadata, nil
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
