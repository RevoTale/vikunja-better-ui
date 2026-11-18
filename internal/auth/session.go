package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"
)

const (
	sessionVersion    = 2
	sessionLifetime   = 30 * 24 * time.Hour
	sessionRefreshAge = sessionLifetime / 2
	sessionIDBytes    = 16
	maxCookieBytes    = 4096
)

// Session validation failures distinguish malformed tokens from expired sessions.
var (
	ErrInvalidSession = errors.New("invalid session")
	ErrExpiredSession = errors.New("expired session")
)

// Session is the authenticated identity and lifetime carried by an encrypted cookie.
type Session struct {
	Version   int
	ID        string
	IssuedAt  time.Time
	ExpiresAt time.Time
	token     string
	origin    string
}

// VikunjaToken returns the credential to use only for this session's private upstream requests.
func (session Session) VikunjaToken() string { return session.token }

// NeedsRefresh reports whether the session has reached its renewal age.
func (session Session) NeedsRefresh(now time.Time) bool {
	return !now.Before(session.IssuedAt.Add(sessionRefreshAge))
}

// SessionManager encrypts origin-bound session cookies and authenticates CSRF tokens.
type SessionManager struct {
	aead    cipher.AEAD
	csrfKey []byte
	now     func() time.Time
	random  io.Reader
}

// NewSessionManager derives independent cookie and CSRF keys from the persistent deployment secret.
func NewSessionManager(secret []byte, now func() time.Time, random io.Reader) (*SessionManager, error) {
	block, err := aes.NewCipher(keyedDigest(secret, "vbu:session:encryption:v2"))
	if err != nil {
		return nil, fmt.Errorf("initialize session cipher: %w", err)
	}
	aead, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		return nil, fmt.Errorf("initialize session encryption: %w", err)
	}
	return &SessionManager{aead: aead, csrfKey: keyedDigest(secret, "vbu:csrf:v2"), now: now, random: random}, nil
}

// Issue creates an encrypted session bound to the application's trusted external origin.
func (manager *SessionManager) Issue(personalToken, origin string) (string, Session, error) {
	if origin == "" || !ValidAPIToken(personalToken) {
		return "", Session{}, ErrInvalidSession
	}
	var idBytes [sessionIDBytes]byte
	if _, err := io.ReadFull(manager.random, idBytes[:]); err != nil {
		return "", Session{}, fmt.Errorf("generate session ID: %w", err)
	}
	session := Session{
		Version: sessionVersion, ID: base64.RawURLEncoding.EncodeToString(idBytes[:]),
		token: personalToken, origin: origin,
	}
	return manager.renew(session)
}

// Refresh extends a verified, unexpired session while retaining its identity and origin.
func (manager *SessionManager) Refresh(previous Session) (string, Session, error) {
	if previous.origin == "" || !manager.now().Before(previous.ExpiresAt) {
		return "", Session{}, ErrInvalidSession
	}
	return manager.renew(previous)
}

func (manager *SessionManager) renew(session Session) (string, Session, error) {
	session.IssuedAt = manager.now().UTC().Truncate(time.Second)
	session.ExpiresAt = session.IssuedAt.Add(sessionLifetime)
	payload, err := json.Marshal(sessionPayload{
		Version: session.Version, ID: session.ID, IssuedAt: session.IssuedAt.Unix(), Token: session.token,
	})
	if err != nil {
		return "", Session{}, fmt.Errorf("marshal session: %w", err)
	}
	// #nosec G407 -- NewGCMWithRandomNonce generates and prepends its own nonce and requires a nil nonce here.
	sealed := manager.aead.Seal(nil, nil, payload, []byte(session.origin))
	return base64.RawURLEncoding.EncodeToString(sealed), session, nil
}

// Parse authenticates the origin and ciphertext before reading the credential or session metadata.
func (manager *SessionManager) Parse(cookie, origin string) (Session, error) {
	if origin == "" || len(cookie) > maxCookieBytes {
		return Session{}, ErrInvalidSession
	}
	sealed, err := base64.RawURLEncoding.Strict().DecodeString(cookie)
	if err != nil {
		return Session{}, ErrInvalidSession
	}
	plaintext, err := manager.aead.Open(nil, nil, sealed, []byte(origin))
	if err != nil {
		return Session{}, ErrInvalidSession
	}
	var payload sessionPayload
	if err := json.Unmarshal(plaintext, &payload); err != nil || payload.Version != sessionVersion {
		return Session{}, ErrInvalidSession
	}
	issuedAt := time.Unix(payload.IssuedAt, 0).UTC()
	expiresAt := issuedAt.Add(sessionLifetime)
	if !manager.now().Before(expiresAt) {
		return Session{}, ErrExpiredSession
	}
	return Session{
		Version: payload.Version, ID: payload.ID, token: payload.Token, origin: origin,
		IssuedAt: issuedAt, ExpiresAt: expiresAt,
	}, nil
}

// CSRFToken derives a token bound to the session identity.
func (manager *SessionManager) CSRFToken(session Session) string {
	return base64.RawURLEncoding.EncodeToString(keyedDigest(manager.csrfKey, session.ID))
}

// VerifyCSRF compares a submitted token with the session-bound signature.
func (manager *SessionManager) VerifyCSRF(session Session, token string) bool {
	expected := manager.CSRFToken(session)
	return len(token) == len(expected) && hmac.Equal([]byte(token), []byte(expected))
}

func keyedDigest(secret []byte, value string) []byte {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(value))
	return mac.Sum(nil)
}

type sessionPayload struct {
	Version  int    `json:"v"`
	ID       string `json:"sid"`
	IssuedAt int64  `json:"iat"`
	Token    string `json:"token"`
}
