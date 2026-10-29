package main

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

func TestOnboardingResetMatchesEmptyCLIAccount(t *testing.T) {
	t.Parallel()
	deleted := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/api/v2/login" {
			_, _ = w.Write([]byte(`{"token":"fixture-jwt"}`))
			return
		}
		if r.Header.Get("Authorization") != "Bearer fixture-jwt" {
			t.Error("missing fixture authorization")
		}
		if r.Method == http.MethodDelete {
			deleted = append(deleted, r.URL.Path)
			w.WriteHeader(http.StatusNoContent)
			return
		}
		_, _ = w.Write([]byte(`{"items":[{"id":7,"title":"Inbox"},{"id":-4,"title":"My Open Tasks"}],"total":1}`))
	}))
	t.Cleanup(server.Close)
	if err := resetOnboarding(t.Context(), server.URL, "fixture", "password"); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(deleted, []string{"/api/v2/projects/7", "/api/v2/filters/3"}) {
		t.Fatalf("deleted resources = %v", deleted)
	}
}
