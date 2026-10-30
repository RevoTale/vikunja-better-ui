package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRegisterUserCreatesCredentialsAndRejectsRedirects(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if r.Method != http.MethodPost || r.URL.Path != "/api/v2/register" ||
			body["username"] != "e2e-test" || body["password"] != "test-password" ||
			body["email"] != "e2e-test@example.invalid" {
			t.Error("unexpected registration request")
		}
		w.WriteHeader(http.StatusCreated)
	}))
	t.Cleanup(server.Close)
	if err := registerUser(t.Context(), server.URL, "e2e-test", "test-password"); err != nil {
		t.Fatal(err)
	}
	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, server.URL, http.StatusTemporaryRedirect)
	}))
	t.Cleanup(redirect.Close)
	if err := registerUser(t.Context(), redirect.URL, "e2e-test", "test-password"); err == nil {
		t.Fatal("accepted registration redirect")
	}
}

func TestRegistrationFailureDoesNotExposeResponseOrCredentials(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "private-password", http.StatusBadRequest)
	}))
	t.Cleanup(server.Close)
	err := registerUser(context.Background(), server.URL, "e2e-test", "private-password")
	if err == nil || strings.Contains(err.Error(), "private-password") {
		t.Fatalf("unsafe error: %v", err)
	}
}
