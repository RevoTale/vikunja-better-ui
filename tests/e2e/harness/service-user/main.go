// Command service-user registers fresh credentials on the disposable CI service.
package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	registrationTimeout = 30 * time.Second
	maxResponseBytes    = 64 << 10
)

func main() {
	if err := run(); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if os.Getenv("CI_SYSTEM_NAME") != "woodpecker" || os.Getenv("E2E_VIKUNJA_SERVICE") != "1" {
		return errors.New("refusing registration outside the isolated Vikunja service")
	}
	var entropy [40]byte
	_, _ = rand.Read(entropy[:])
	username := "e2e-" + hex.EncodeToString(entropy[:16])
	password := hex.EncodeToString(entropy[16:])
	if err := registerUser(context.Background(), "http://vikunja:3456", username, password); err != nil {
		return err
	}
	if err := resetOnboarding(context.Background(), "http://vikunja:3456", username, password); err != nil {
		return err
	}
	// The harness captures stdout; credentials must never be printed to CI logs.
	_, err := fmt.Fprintln(os.Stdout, username, password)
	return err
}

func registerUser(ctx context.Context, baseURL, username, password string) error {
	return fixtureRequest(ctx, baseURL, http.MethodPost, "/register", "", map[string]string{
		"username": username, "password": password, "email": username + "@example.invalid",
	}, nil)
}

func fixtureRequest(ctx context.Context, baseURL, method, path, token string, input, output any) error {
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, method, baseURL+"/api/v2"+path, bytes.NewReader(body))
	if err != nil {
		return errors.New("invalid fixture registration URL")
	}
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{
		Timeout: registrationTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	response, err := client.Do(request)
	if err != nil {
		return errors.New("vikunja fixture registration request failed")
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("vikunja fixture registration failed: HTTP %d", response.StatusCode)
	}
	if output != nil {
		return json.NewDecoder(io.LimitReader(response.Body, maxResponseBytes)).Decode(output)
	}
	_, err = io.Copy(io.Discard, io.LimitReader(response.Body, maxResponseBytes))
	return err
}
