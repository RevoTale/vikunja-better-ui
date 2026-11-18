package auth

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestPersonalCredentialSealedForOneOriginAcrossReplicas(t *testing.T) {
	t.Parallel()
	const origin = "http://10.77.0.20:8080"
	const fixture = "tk_readable_fixture"
	manager := replica(t, "deployment-secret")
	encoded, session, err := manager.Issue(fixture, origin)
	if err != nil {
		t.Fatal(err)
	}
	if session.VikunjaToken() != fixture {
		t.Fatal("issued session lost the verified credential")
	}
	wire, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil || bytes.Contains(wire, []byte(fixture)) {
		t.Fatal("cookie must carry ciphertext")
	}
	parsed, err := replica(t, "deployment-secret").Parse(encoded, origin)
	if err != nil || parsed.ID != session.ID || parsed.VikunjaToken() != fixture {
		t.Fatal("second replica could not recover the same user's session")
	}
	for _, wrongOrigin := range []string{"", "https://10.77.0.20:8080", "http://10.77.0.20:9090"} {
		if _, err := manager.Parse(encoded, wrongOrigin); !errors.Is(err, ErrInvalidSession) {
			t.Errorf("cookie accepted for %q", wrongOrigin)
		}
	}
	if _, err := replica(t, "replacement-secret").Parse(encoded, origin); !errors.Is(err, ErrInvalidSession) {
		t.Fatal("rotated key accepted previous cookie")
	}
	if _, err := manager.Parse("legacyPayload.legacySignature", origin); !errors.Is(err, ErrInvalidSession) {
		t.Fatal("legacy signed cookie accepted")
	}
}

func TestCookieSizeAndAccountIsolation(t *testing.T) {
	t.Parallel()
	manager := replica(t, "key")
	const origin = "https://tasks.test"
	fixture := "tk_" + strings.Repeat("x", maxAPITokenBytes-3)
	cookie, first, err := manager.Issue(fixture, origin)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	NewSessionCookies(true).Start(rec, cookie, first)
	for _, header := range rec.Header().Values("Set-Cookie") {
		if len(header) >= maxCookieBytes {
			t.Fatal("largest encrypted cookie exceeds the browser limit")
		}
	}
	_, second, err := manager.Issue("tk_second", origin)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID == second.ID || manager.VerifyCSRF(second, manager.CSRFToken(first)) {
		t.Fatal("new login reused prior session identity")
	}
}

func TestMissingTrustedOriginFailsClosed(t *testing.T) {
	t.Parallel()
	manager := replica(t, "key")
	handler := HTTPContext(manager, func(*http.Request) string { return "" })(http.HandlerFunc(
		func(http.ResponseWriter, *http.Request) { t.Fatal("missing origin reached handlers") },
	))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "http://app.test/graphql", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, request)
	if rec.Code != http.StatusForbidden {
		t.Errorf("status %d", rec.Code)
	}
}

func replica(t *testing.T, secret string) *SessionManager {
	t.Helper()
	manager, err := NewSessionManager([]byte(secret), time.Now, rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return manager
}
