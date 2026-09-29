package auth

import (
	"crypto/sha256"
	"crypto/subtle"
	"errors"
)

// ErrInvalidCredentials intentionally does not identify which credential mismatched.
var ErrInvalidCredentials = errors.New("invalid username or password")

// Credentials holds fixed-size digests for constant-time credential comparison.
type Credentials struct {
	usernameHash [sha256.Size]byte
	passwordHash [sha256.Size]byte
}

// NewCredentials hashes configured app credentials; it does not authenticate to Vikunja.
func NewCredentials(username string, password string) Credentials {
	return Credentials{
		usernameHash: sha256.Sum256([]byte(username)),
		passwordHash: sha256.Sum256([]byte(password)),
	}
}

// Verify compares both credential digests without short-circuiting on a mismatch.
func (credentials Credentials) Verify(username string, password string) error {
	usernameHash := sha256.Sum256([]byte(username))
	passwordHash := sha256.Sum256([]byte(password))
	usernameMatches := subtle.ConstantTimeCompare(credentials.usernameHash[:], usernameHash[:])
	passwordMatches := subtle.ConstantTimeCompare(credentials.passwordHash[:], passwordHash[:])

	if usernameMatches&passwordMatches != 1 {
		return ErrInvalidCredentials
	}

	return nil
}
