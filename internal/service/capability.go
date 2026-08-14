package service

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
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
	capabilityVersion      = 1
	undoLifetime           = 30 * time.Second
	repairLifetime         = 15 * time.Minute
	undoPurpose            = "undo"
	markerRepairPurpose    = "marker-repair"
	recurringRepairPurpose = "recurring-repair"
)

var (
	ErrInvalidCapability = errors.New("invalid capability")
	ErrExpiredCapability = errors.New("expired capability")
)

type UndoGrant struct {
	TaskID int64
	Kind   TaskKind
	DoneAt time.Time
	ETag   string
}

type MarkerRepairGrant struct {
	TaskID      int64
	MarkerTitle string
	ETag        string
}

type RecurringRepairGrant struct {
	TaskID        int64
	ProjectID     int64
	LiveETag      string
	CompletionKey string
	Outcome       CompletionOutcome
	DueAt         time.Time
	StartAt       time.Time
	EndAt         time.Time
}

type CapabilityManager struct {
	secret []byte
	now    func() time.Time
}

func NewCapabilityManager(secret []byte, now func() time.Time) *CapabilityManager {
	return &CapabilityManager{secret: append([]byte(nil), secret...), now: now}
}

func (manager *CapabilityManager) CompletionKey(taskID int64, completedAt time.Time) string {
	message := fmt.Sprintf("vbu:completion:v1:%d:%s", taskID, completedAt.UTC().Format(time.RFC3339Nano))
	mac := hmac.New(sha256.New, manager.secret)
	_, _ = mac.Write([]byte(message))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (manager *CapabilityManager) IssueUndo(sessionID string, grant UndoGrant) (string, time.Time, error) {
	if !validUndoGrant(sessionID, grant) {
		return "", time.Time{}, fmt.Errorf("undo grant is invalid")
	}
	expiresAt := manager.now().UTC().Truncate(time.Second).Add(undoLifetime)
	payload := undoCapabilityPayload{
		Version: capabilityVersion, Purpose: undoPurpose, SessionID: sessionID,
		TaskID: grant.TaskID, Kind: grant.Kind, DoneAt: grant.DoneAt.Format(time.RFC3339Nano), ETag: grant.ETag,
		ExpiresAt: expiresAt.Unix(),
	}
	token, err := manager.signPayload(payload)
	if err != nil {
		return "", time.Time{}, err
	}
	return token, expiresAt, nil
}

func (manager *CapabilityManager) ParseUndo(sessionID string, token string) (UndoGrant, error) {
	var payload undoCapabilityPayload
	if err := manager.parsePayload(token, &payload); err != nil {
		return UndoGrant{}, err
	}
	doneAt, err := time.Parse(time.RFC3339Nano, payload.DoneAt)
	if err != nil {
		return UndoGrant{}, ErrInvalidCapability
	}
	grant := UndoGrant{TaskID: payload.TaskID, Kind: payload.Kind, DoneAt: doneAt, ETag: payload.ETag}
	if payload.Version != capabilityVersion || payload.Purpose != undoPurpose || payload.SessionID != sessionID ||
		!validUndoGrant(sessionID, grant) {
		return UndoGrant{}, ErrInvalidCapability
	}
	if !manager.now().Before(time.Unix(payload.ExpiresAt, 0)) {
		return UndoGrant{}, ErrExpiredCapability
	}
	return grant, nil
}

func (manager *CapabilityManager) IssueMarkerRepair(sessionID string, grant MarkerRepairGrant) (string, error) {
	if !validMarkerRepairGrant(sessionID, grant) {
		return "", fmt.Errorf("marker repair grant is invalid")
	}
	payload := markerRepairCapabilityPayload{
		Version: capabilityVersion, Purpose: markerRepairPurpose, SessionID: sessionID,
		TaskID: grant.TaskID, MarkerTitle: grant.MarkerTitle, ETag: grant.ETag,
		ExpiresAt: manager.now().UTC().Truncate(time.Second).Add(repairLifetime).Unix(),
	}
	return manager.signPayload(payload)
}

func (manager *CapabilityManager) ParseMarkerRepair(sessionID string, token string) (MarkerRepairGrant, error) {
	var payload markerRepairCapabilityPayload
	if err := manager.parsePayload(token, &payload); err != nil {
		return MarkerRepairGrant{}, err
	}
	grant := MarkerRepairGrant{TaskID: payload.TaskID, MarkerTitle: payload.MarkerTitle, ETag: payload.ETag}
	if payload.Version != capabilityVersion || payload.Purpose != markerRepairPurpose || payload.SessionID != sessionID ||
		!validMarkerRepairGrant(sessionID, grant) {
		return MarkerRepairGrant{}, ErrInvalidCapability
	}
	if !manager.now().Before(time.Unix(payload.ExpiresAt, 0)) {
		return MarkerRepairGrant{}, ErrExpiredCapability
	}
	return grant, nil
}

func (manager *CapabilityManager) IssueRecurringRepair(sessionID string, grant RecurringRepairGrant) (string, error) {
	if !validRecurringRepairGrant(sessionID, grant) {
		return "", fmt.Errorf("recurring repair grant is invalid")
	}
	payload := recurringRepairCapabilityPayload{
		Version: capabilityVersion, Purpose: recurringRepairPurpose, SessionID: sessionID,
		TaskID: grant.TaskID, ProjectID: grant.ProjectID, LiveETag: grant.LiveETag,
		CompletionKey: grant.CompletionKey, Outcome: grant.Outcome,
		DueAt: formatOptionalInstant(grant.DueAt), StartAt: formatOptionalInstant(grant.StartAt),
		EndAt:     formatOptionalInstant(grant.EndAt),
		ExpiresAt: manager.now().UTC().Truncate(time.Second).Add(repairLifetime).Unix(),
	}
	return manager.sealPayload(payload)
}

func (manager *CapabilityManager) ParseRecurringRepair(sessionID string, token string) (RecurringRepairGrant, error) {
	var payload recurringRepairCapabilityPayload
	if err := manager.openPayload(token, &payload); err != nil {
		return RecurringRepairGrant{}, err
	}
	dueAt, err := parseOptionalInstant(payload.DueAt)
	if err != nil {
		return RecurringRepairGrant{}, ErrInvalidCapability
	}
	startAt, err := parseOptionalInstant(payload.StartAt)
	if err != nil {
		return RecurringRepairGrant{}, ErrInvalidCapability
	}
	endAt, err := parseOptionalInstant(payload.EndAt)
	if err != nil {
		return RecurringRepairGrant{}, ErrInvalidCapability
	}
	grant := RecurringRepairGrant{
		TaskID: payload.TaskID, ProjectID: payload.ProjectID, LiveETag: payload.LiveETag,
		CompletionKey: payload.CompletionKey, Outcome: payload.Outcome,
		DueAt: dueAt, StartAt: startAt, EndAt: endAt,
	}
	if payload.Version != capabilityVersion || payload.Purpose != recurringRepairPurpose || payload.SessionID != sessionID ||
		!validRecurringRepairGrant(sessionID, grant) {
		return RecurringRepairGrant{}, ErrInvalidCapability
	}
	if !manager.now().Before(time.Unix(payload.ExpiresAt, 0)) {
		return RecurringRepairGrant{}, ErrExpiredCapability
	}
	return grant, nil
}

func (manager *CapabilityManager) signPayload(payload any) (string, error) {
	encodedJSON, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal capability: %w", err)
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(encodedJSON)
	return encodedPayload + "." + manager.signature(encodedPayload), nil
}

func (manager *CapabilityManager) parsePayload(token string, destination any) error {
	encodedPayload, signature, ok := strings.Cut(token, ".")
	if !ok || encodedPayload == "" || signature == "" || strings.Contains(signature, ".") {
		return ErrInvalidCapability
	}
	expected := manager.signature(encodedPayload)
	if len(signature) != len(expected) || !hmac.Equal([]byte(signature), []byte(expected)) {
		return ErrInvalidCapability
	}
	payload, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return ErrInvalidCapability
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return ErrInvalidCapability
	}
	return nil
}

func (manager *CapabilityManager) sealPayload(payload any) (string, error) {
	plaintext, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal sealed capability: %w", err)
	}
	aead, err := manager.capabilityAEAD()
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize(), aead.NonceSize()+len(plaintext)+aead.Overhead())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate capability nonce: %w", err)
	}
	ciphertext := aead.Seal(nil, nonce, plaintext, []byte(recurringRepairPurpose))
	nonce = append(nonce, ciphertext...)
	return "rr." + base64.RawURLEncoding.EncodeToString(nonce), nil
}

func (manager *CapabilityManager) openPayload(token string, destination any) error {
	encoded, ok := strings.CutPrefix(token, "rr.")
	if !ok {
		return ErrInvalidCapability
	}
	sealed, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return ErrInvalidCapability
	}
	aead, err := manager.capabilityAEAD()
	if err != nil || len(sealed) <= aead.NonceSize() {
		return ErrInvalidCapability
	}
	plaintext, err := aead.Open(nil, sealed[:aead.NonceSize()], sealed[aead.NonceSize():], []byte(recurringRepairPurpose))
	if err != nil {
		return ErrInvalidCapability
	}
	decoder := json.NewDecoder(bytes.NewReader(plaintext))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return ErrInvalidCapability
	}
	return nil
}

func (manager *CapabilityManager) capabilityAEAD() (cipher.AEAD, error) {
	key := sha256.Sum256(append([]byte("vbu:recurring-repair:encryption:v1:"), manager.secret...))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("create capability cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create capability AEAD: %w", err)
	}
	return aead, nil
}

func (manager *CapabilityManager) signature(payload string) string {
	mac := hmac.New(sha256.New, manager.secret)
	_, _ = mac.Write([]byte("vbu:capability:v1:" + payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func validUndoGrant(sessionID string, grant UndoGrant) bool {
	validKind := grant.Kind == TaskKindOneTime || grant.Kind == TaskKindJob
	return sessionID != "" && grant.TaskID > 0 && validKind && !grant.DoneAt.IsZero() && grant.ETag != ""
}

func validMarkerRepairGrant(sessionID string, grant MarkerRepairGrant) bool {
	return sessionID != "" && grant.TaskID > 0 && isMarkerTitle(grant.MarkerTitle) && grant.ETag != ""
}

func validRecurringRepairGrant(sessionID string, grant RecurringRepairGrant) bool {
	validOutcome := grant.Outcome == CompletionOutcomeCompleted || grant.Outcome == CompletionOutcomeSkipped
	return sessionID != "" && grant.TaskID > 0 && grant.ProjectID > 0 && grant.LiveETag != "" &&
		grant.CompletionKey != "" && validOutcome
}

func formatOptionalInstant(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339Nano)
}

func parseOptionalInstant(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, nil
	}
	return time.Parse(time.RFC3339Nano, value)
}

type undoCapabilityPayload struct {
	Version   int      `json:"v"`
	Purpose   string   `json:"purpose"`
	SessionID string   `json:"sid"`
	TaskID    int64    `json:"task_id"`
	Kind      TaskKind `json:"kind"`
	DoneAt    string   `json:"done_at"`
	ETag      string   `json:"etag"`
	ExpiresAt int64    `json:"exp"`
}

type markerRepairCapabilityPayload struct {
	Version     int    `json:"v"`
	Purpose     string `json:"purpose"`
	SessionID   string `json:"sid"`
	TaskID      int64  `json:"task_id"`
	MarkerTitle string `json:"marker"`
	ETag        string `json:"etag"`
	ExpiresAt   int64  `json:"exp"`
}

type recurringRepairCapabilityPayload struct {
	Version       int               `json:"v"`
	Purpose       string            `json:"purpose"`
	SessionID     string            `json:"sid"`
	TaskID        int64             `json:"task_id"`
	ProjectID     int64             `json:"project_id"`
	LiveETag      string            `json:"live_etag"`
	CompletionKey string            `json:"completion_key"`
	Outcome       CompletionOutcome `json:"outcome"`
	DueAt         string            `json:"due_at"`
	StartAt       string            `json:"start_at"`
	EndAt         string            `json:"end_at"`
	ExpiresAt     int64             `json:"exp"`
}
