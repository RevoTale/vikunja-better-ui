package auth

import (
	"crypto/sha256"
	"crypto/subtle"
	"errors"
)

var ErrInvalidCredentials = errors.New("invalid username or password")

type Credentials struct {
	usernameHash [sha256.Size]byte
	passwordHash [sha256.Size]byte
}

func NewCredentials(username string, password string) Credentials {
	return Credentials{
		usernameHash: sha256.Sum256([]byte(username)),
		passwordHash: sha256.Sum256([]byte(password)),
	}
}

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
