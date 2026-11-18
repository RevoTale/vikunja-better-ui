// Package auth manages encrypted stateless sessions for personal Vikunja API tokens.
package auth

import (
	"encoding/base64"
	"net/http"
	"time"
)

const (
	productionSessionCookie = "__Host-vbu_session"
	localSessionCookie      = "vbu_session"
	selectorLifetime        = 400 * 24 * time.Hour
)

// SessionCookies applies origin-specific security attributes to session cookies.
type SessionCookies struct {
	name   string
	secure bool
}

// NewSessionCookies uses the trusted external scheme to select a distinct cookie name and policy.
func NewSessionCookies(secure bool) SessionCookies {
	if secure {
		return SessionCookies{name: productionSessionCookie, secure: true}
	}
	return SessionCookies{name: localSessionCookie}
}

// Start selects a new login and stores its encrypted credential under a session-specific name.
func (cookies SessionCookies) Start(w http.ResponseWriter, token string, session Session) {
	cookies.write(w, cookies.name, session.ID, session.IssuedAt.Add(selectorLifetime), 0)
	cookies.renew(w, token, session)
}

func (cookies SessionCookies) renew(w http.ResponseWriter, token string, session Session) {
	cookies.write(w, cookies.name+"_"+session.ID, token, session.ExpiresAt, 0)
}

func (cookies SessionCookies) selected(r *http.Request) string {
	selector, err := r.Cookie(cookies.name)
	if err != nil || len(selector.Value) != base64.RawURLEncoding.EncodedLen(sessionIDBytes) {
		return ""
	}
	if _, err := base64.RawURLEncoding.Strict().DecodeString(selector.Value); err != nil {
		return ""
	}
	return selector.Value
}

func (cookies SessionCookies) clearCredential(w http.ResponseWriter, id string) {
	if id != "" {
		cookies.write(w, cookies.name+"_"+id, "", time.Unix(1, 0).UTC(), -1)
	}
}

func (cookies SessionCookies) write(w http.ResponseWriter, name, value string, expires time.Time, maxAge int) {
	// #nosec G124 -- private HTTP origins need an unprefixed cookie; HTTPS always sets Secure.
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: value, Path: "/", Expires: expires, MaxAge: maxAge,
		Secure: cookies.secure, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
}
