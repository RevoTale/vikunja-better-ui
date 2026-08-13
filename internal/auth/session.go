package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
)

const (
	sessionVersion  = 1
	sessionLifetime = 30 * 24 * time.Hour
	sessionIDBytes  = 16
	csrfPurpose     = "vbu:csrf:v1"
)

var (
	ErrInvalidSession = errors.New("invalid session")
	ErrExpiredSession = errors.New("expired session")
)

type Session struct {
	Version   int
	ID        string
	IssuedAt  time.Time
	ExpiresAt time.Time
}

func (session Session) NeedsRefresh(now time.Time) bool {
	return !now.Before(session.IssuedAt.Add(sessionLifetime / 2))
}

type SessionManager struct {
	secret []byte
	now    func() time.Time
	random io.Reader
}

func NewSessionManager(secret []byte, now func() time.Time, random io.Reader) *SessionManager {
	return &SessionManager{
		secret: append([]byte(nil), secret...),
		now:    now,
		random: random,
	}
}

func (manager *SessionManager) Issue() (string, Session, error) {
	idBytes := make([]byte, sessionIDBytes)
	if _, err := io.ReadFull(manager.random, idBytes); err != nil {
		return "", Session{}, fmt.Errorf("generate session ID: %w", err)
	}

	issuedAt := manager.now().UTC().Truncate(time.Second)
	session := Session{
		Version:   sessionVersion,
		ID:        base64.RawURLEncoding.EncodeToString(idBytes),
		IssuedAt:  issuedAt,
		ExpiresAt: issuedAt.Add(sessionLifetime),
	}
	return manager.encode(session)
}

func (manager *SessionManager) Refresh(previous Session) (string, Session, error) {
	if !validSessionShape(previous) {
		return "", Session{}, ErrInvalidSession
	}
	issuedAt := manager.now().UTC().Truncate(time.Second)
	refreshed := Session{
		Version: sessionVersion, ID: previous.ID,
		IssuedAt: issuedAt, ExpiresAt: issuedAt.Add(sessionLifetime),
	}
	return manager.encode(refreshed)
}

func (manager *SessionManager) encode(session Session) (string, Session, error) {
	payload, err := json.Marshal(sessionPayload{
		Version:   session.Version,
		ID:        session.ID,
		IssuedAt:  session.IssuedAt.Unix(),
		ExpiresAt: session.ExpiresAt.Unix(),
	})
	if err != nil {
		return "", Session{}, fmt.Errorf("marshal session: %w", err)
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	return encodedPayload + "." + manager.signature(encodedPayload), session, nil
}

func (manager *SessionManager) Parse(token string) (Session, error) {
	encodedPayload, encodedSignature, ok := strings.Cut(token, ".")
	if !ok || encodedPayload == "" || encodedSignature == "" || strings.Contains(encodedSignature, ".") {
		return Session{}, ErrInvalidSession
	}

	expectedSignature := manager.signature(encodedPayload)
	if len(encodedSignature) != len(expectedSignature) || !hmac.Equal([]byte(encodedSignature), []byte(expectedSignature)) {
		return Session{}, ErrInvalidSession
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return Session{}, ErrInvalidSession
	}

	var payload sessionPayload
	decoder := json.NewDecoder(strings.NewReader(string(payloadBytes)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		return Session{}, ErrInvalidSession
	}

	session := Session{
		Version:   payload.Version,
		ID:        payload.ID,
		IssuedAt:  time.Unix(payload.IssuedAt, 0).UTC(),
		ExpiresAt: time.Unix(payload.ExpiresAt, 0).UTC(),
	}
	if !validSessionShape(session) {
		return Session{}, ErrInvalidSession
	}
	if !manager.now().Before(session.ExpiresAt) {
		return Session{}, ErrExpiredSession
	}

	return session, nil
}

func (manager *SessionManager) CSRFToken(session Session) string {
	message := csrfPurpose + ":" + session.ID
	return manager.signBytes([]byte(message))
}

func (manager *SessionManager) VerifyCSRF(session Session, token string) bool {
	expected := manager.CSRFToken(session)
	return len(token) == len(expected) && hmac.Equal([]byte(token), []byte(expected))
}

func (manager *SessionManager) signature(encodedPayload string) string {
	return manager.signBytes([]byte("vbu:session:v1:" + encodedPayload))
}

func (manager *SessionManager) signBytes(message []byte) string {
	mac := hmac.New(sha256.New, manager.secret)
	_, _ = mac.Write(message)
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func validSessionShape(session Session) bool {
	if session.Version != sessionVersion || session.ID == "" {
		return false
	}
	decodedID, err := base64.RawURLEncoding.DecodeString(session.ID)
	if err != nil || len(decodedID) != sessionIDBytes {
		return false
	}
	return session.ExpiresAt.Sub(session.IssuedAt) == sessionLifetime
}

type sessionPayload struct {
	Version   int    `json:"v"`
	ID        string `json:"sid"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}
