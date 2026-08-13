package auth

import (
	"net/http"
	"time"
)

const (
	productionSessionCookie = "__Host-vbu_session"
	localSessionCookie      = "vbu_session"
)

type SessionCookies struct {
	name   string
	secure bool
}

func NewSessionCookies(production bool) SessionCookies {
	if production {
		return SessionCookies{name: productionSessionCookie, secure: true}
	}
	return SessionCookies{name: localSessionCookie, secure: false}
}

func (cookies SessionCookies) Set(writer http.ResponseWriter, token string, expiresAt time.Time) {
	http.SetCookie(writer, cookies.cookie(token, expiresAt, 0))
}

func (cookies SessionCookies) Clear(writer http.ResponseWriter) {
	http.SetCookie(writer, cookies.cookie("", time.Unix(1, 0).UTC(), -1))
}

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
