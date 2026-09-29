package auth

import (
	"context"
	"net"
	"net/http"
)

type requestContextKey int

const (
	sessionContextKey requestContextKey = iota
	requestInfoContextKey
)

// RequestInfo exposes the HTTP boundary to authentication mutations.
type RequestInfo struct {
	Writer   http.ResponseWriter
	Request  *http.Request
	ClientIP string
}

// HTTPContext attaches a verified, optionally refreshed session to each request.
func HTTPContext(manager *SessionManager, cookies SessionCookies) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			info := &RequestInfo{
				Writer: writer, Request: request, ClientIP: clientIP(request.RemoteAddr),
			}
			ctx := context.WithValue(request.Context(), requestInfoContextKey, info)
			if session, ok := requestSession(manager, cookies, writer, request); ok {
				ctx = context.WithValue(ctx, sessionContextKey, session)
			}
			request = request.WithContext(ctx)
			info.Request = request
			next.ServeHTTP(writer, request)
		})
	}
}

func requestSession(
	manager *SessionManager, cookies SessionCookies, writer http.ResponseWriter, request *http.Request,
) (Session, bool) {
	token, err := cookies.Read(request)
	if err != nil {
		return Session{}, false
	}
	session, err := manager.Parse(token)
	if err != nil {
		cookies.Clear(writer)
		return Session{}, false
	}
	if !session.NeedsRefresh(manager.now()) {
		return session, true
	}
	refreshedToken, refreshed, err := manager.Refresh(session)
	if err != nil {
		cookies.Clear(writer)
		return Session{}, false
	}
	cookies.Set(writer, refreshedToken, refreshed.ExpiresAt)
	return refreshed, true
}

// SessionFromContext returns the verified session, if authentication succeeded.
func SessionFromContext(ctx context.Context) (Session, bool) {
	session, ok := ctx.Value(sessionContextKey).(Session)
	return session, ok
}

// RequestInfoFromContext returns the HTTP mutation boundary, when installed.
func RequestInfoFromContext(ctx context.Context) (RequestInfo, bool) {
	info, ok := ctx.Value(requestInfoContextKey).(*RequestInfo)
	if !ok || info == nil {
		return RequestInfo{}, false
	}
	return *info, true
}

func clientIP(remoteAddress string) string {
	host, _, err := net.SplitHostPort(remoteAddress)
	if err == nil {
		return host
	}
	return remoteAddress
}
