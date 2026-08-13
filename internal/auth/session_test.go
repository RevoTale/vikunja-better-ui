package auth

import (
	"bytes"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestSessionManagerIssueAndParse(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 9, 30, 0, 0, time.UTC)
	manager := NewSessionManager(
		[]byte("0123456789abcdef0123456789abcdef"),
		func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)

	token, issued, err := manager.Issue()
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}
	if issued.ID == "" {
		t.Fatal("Issue() session ID is empty")
	}
	if got, want := issued.ExpiresAt, now.Add(30*24*time.Hour); !got.Equal(want) {
		t.Fatalf("ExpiresAt = %v, want %v", got, want)
	}

	parsed, err := manager.Parse(token)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if parsed != issued {
		t.Fatalf("Parse() = %#v, want %#v", parsed, issued)
	}
	if manager.CSRFToken(parsed) == "" {
		t.Fatal("CSRFToken() is empty")
	}
}

func TestSessionManagerRejectsInvalidToken(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 9, 30, 0, 0, time.UTC)
	manager := NewSessionManager(
		[]byte("0123456789abcdef0123456789abcdef"),
		func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	token, _, err := manager.Issue()
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}

	tests := []struct {
		name  string
		token string
	}{
		{name: "empty", token: ""},
		{name: "malformed", token: "not-a-session"},
		{name: "tampered", token: token[:len(token)-1] + differentLastByte(token)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			_, parseErr := manager.Parse(test.token)
			if !errors.Is(parseErr, ErrInvalidSession) {
				t.Fatalf("Parse() error = %v, want ErrInvalidSession", parseErr)
			}
		})
	}
}

func TestSessionManagerRejectsExpiredToken(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 9, 30, 0, 0, time.UTC)
	manager := NewSessionManager(
		[]byte("0123456789abcdef0123456789abcdef"),
		func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	token, _, err := manager.Issue()
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}

	now = now.Add(30*24*time.Hour + time.Second)
	_, err = manager.Parse(token)
	if !errors.Is(err, ErrExpiredSession) {
		t.Fatalf("Parse() error = %v, want ErrExpiredSession", err)
	}
}

func TestSessionRefreshPolicy(t *testing.T) {
	t.Parallel()

	issuedAt := time.Date(2026, time.August, 12, 9, 30, 0, 0, time.UTC)
	session := Session{
		Version:   sessionVersion,
		ID:        "session-id",
		IssuedAt:  issuedAt,
		ExpiresAt: issuedAt.Add(30 * 24 * time.Hour),
	}

	if session.NeedsRefresh(issuedAt.Add(15*24*time.Hour - time.Second)) {
		t.Fatal("NeedsRefresh() = true before half-life")
	}
	if !session.NeedsRefresh(issuedAt.Add(15 * 24 * time.Hour)) {
		t.Fatal("NeedsRefresh() = false at half-life")
	}
}

func TestSessionManagerRefreshPreservesSessionID(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 9, 30, 0, 0, time.UTC)
	manager := NewSessionManager(
		[]byte("0123456789abcdef0123456789abcdef"),
		func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	_, issued, err := manager.Issue()
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(16 * 24 * time.Hour)
	token, refreshed, err := manager.Refresh(issued)
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	if refreshed.ID != issued.ID || !refreshed.IssuedAt.Equal(now) {
		t.Fatalf("Refresh() = %#v", refreshed)
	}
	parsed, err := manager.Parse(token)
	if err != nil || parsed != refreshed {
		t.Fatalf("Parse(refreshed) = %#v, %v", parsed, err)
	}
}

func TestCSRFTokenIsBoundToSession(t *testing.T) {
	t.Parallel()

	manager := NewSessionManager(
		[]byte("0123456789abcdef0123456789abcdef"),
		time.Now,
		strings.NewReader("0123456789abcdef"),
	)
	first := manager.CSRFToken(Session{ID: "first"})
	second := manager.CSRFToken(Session{ID: "second"})
	if first == second {
		t.Fatal("CSRFToken() returned the same token for different sessions")
	}
	if !manager.VerifyCSRF(Session{ID: "first"}, first) {
		t.Fatal("VerifyCSRF() rejected matching token")
	}
	if manager.VerifyCSRF(Session{ID: "first"}, second) {
		t.Fatal("VerifyCSRF() accepted another session's token")
	}
}

func differentLastByte(token string) string {
	if strings.HasSuffix(token, "A") {
		return "B"
	}
	return "A"
}
