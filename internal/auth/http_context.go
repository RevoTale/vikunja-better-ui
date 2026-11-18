package auth

import (
	"context"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type requestContextKey int

const (
	sessionContextKey requestContextKey = iota
	requestInfoContextKey
)

// RequestInfo exposes the HTTP boundary to authentication mutations.
type RequestInfo struct {
	Writer      http.ResponseWriter
	Request     *http.Request
	ClientIP    string
	Origin      string
	Cookies     SessionCookies
	selectedID  string
	clearCookie sync.Once
}

// ClearSession expires the request cookie once, including when a query selects multiple session fields.
func (info *RequestInfo) ClearSession() {
	info.clearCookie.Do(func() { info.Cookies.clearCredential(info.Writer, info.selectedID) })
}

// Logout clears the active selector and this request's credential after an explicit sign-out.
func (info *RequestInfo) Logout() {
	info.ClearSession()
	info.Cookies.write(info.Writer, info.Cookies.name, "", time.Unix(1, 0).UTC(), -1)
}

// HTTPContext attaches a verified, optionally refreshed session to each request.
func HTTPContext(manager *SessionManager, requestOrigin func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			origin := requestOrigin(request)
			if origin == "" {
				http.Error(writer, "trusted browser origin unavailable", http.StatusForbidden)
				return
			}
			cookies := NewSessionCookies(strings.HasPrefix(origin, "https://"))
			info := &RequestInfo{
				Origin: origin, Cookies: cookies, selectedID: cookies.selected(request),
				Writer: writer, Request: request, ClientIP: clientIP(request.RemoteAddr),
			}
			ctx := context.WithValue(request.Context(), requestInfoContextKey, info)
			if session, ok := requestSession(manager, info); ok {
				ctx = context.WithValue(ctx, sessionContextKey, session)
			}
			request = request.WithContext(ctx)
			info.Request = request
			next.ServeHTTP(writer, request)
		})
	}
}

func requestSession(manager *SessionManager, info *RequestInfo) (Session, bool) {
	if info.selectedID == "" {
		return Session{}, false
	}
	cookie, err := info.Request.Cookie(info.Cookies.name + "_" + info.selectedID)
	if err != nil {
		return Session{}, false
	}
	session, err := manager.Parse(cookie.Value, info.Origin)
	if err != nil || session.ID != info.selectedID {
		info.ClearSession()
		return Session{}, false
	}
	if !session.NeedsRefresh(manager.now()) {
		return session, true
	}
	refreshedToken, refreshed, err := manager.Refresh(session)
	if err != nil {
		info.ClearSession()
		return Session{}, false
	}
	info.Cookies.renew(info.Writer, refreshedToken, refreshed)
	return refreshed, true
}

// SessionFromContext returns the verified session, if authentication succeeded.
func SessionFromContext(ctx context.Context) (Session, bool) {
	session, ok := ctx.Value(sessionContextKey).(Session)
	return session, ok
}

// RequestInfoFromContext returns the HTTP mutation boundary, when installed.
func RequestInfoFromContext(ctx context.Context) (*RequestInfo, bool) {
	info, ok := ctx.Value(requestInfoContextKey).(*RequestInfo)
	if !ok || info == nil {
		return nil, false
	}
	return info, true
}

func clientIP(remoteAddress string) string {
	host, _, err := net.SplitHostPort(remoteAddress)
	if err == nil {
		return host
	}
	return remoteAddress
}
