// Package auth verifies app credentials and manages signed stateless sessions.
package auth

import (
	"net/http"
	"time"
)

const (
	productionSessionCookie = "__Host-vbu_session"
	localSessionCookie      = "vbu_session"
)

// SessionCookies applies environment-specific security attributes to session cookies.
type SessionCookies struct {
	name   string
	secure bool
}

// NewSessionCookies requires HTTPS and the host-only cookie prefix in production.
func NewSessionCookies(production bool) SessionCookies {
	if production {
		return SessionCookies{name: productionSessionCookie, secure: true}
	}
	return SessionCookies{name: localSessionCookie, secure: false}
}

// Set writes a signed session token with its absolute expiry.
func (cookies SessionCookies) Set(writer http.ResponseWriter, token string, expiresAt time.Time) {
	http.SetCookie(writer, cookies.cookie(token, expiresAt, 0))
}

// Clear expires the current environment's session cookie.
func (cookies SessionCookies) Clear(writer http.ResponseWriter) {
	http.SetCookie(writer, cookies.cookie("", time.Unix(1, 0).UTC(), -1))
}

// Read extracts the unverified session token from the request.
func (cookies SessionCookies) Read(request *http.Request) (string, error) {
	cookie, err := request.Cookie(cookies.name)
	if err != nil {
		return "", err
	}
	return cookie.Value, nil
}

func (cookies SessionCookies) cookie(value string, expiresAt time.Time, maxAge int) *http.Cookie {
	// #nosec G124 -- local development intentionally uses HTTP; production always sets Secure.
	return &http.Cookie{
		Name:     cookies.name,
		Value:    value,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   maxAge,
		Secure:   cookies.secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
}
