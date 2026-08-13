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

type RequestInfo struct {
	Writer   http.ResponseWriter
	Request  *http.Request
	ClientIP string
}

func HTTPContext(manager *SessionManager, cookies SessionCookies) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			info := &RequestInfo{
				Writer: writer, Request: request, ClientIP: clientIP(request.RemoteAddr),
			}
			ctx := context.WithValue(request.Context(), requestInfoContextKey, info)
			if token, err := cookies.Read(request); err == nil {
				session, parseErr := manager.Parse(token)
				if parseErr == nil {
					usable := true
					if session.NeedsRefresh(manager.now()) {
						refreshedToken, refreshed, refreshErr := manager.Refresh(session)
						if refreshErr != nil {
							cookies.Clear(writer)
							usable = false
						} else {
							cookies.Set(writer, refreshedToken, refreshed.ExpiresAt)
							session = refreshed
						}
					}
					if usable {
						ctx = context.WithValue(ctx, sessionContextKey, session)
					}
				} else {
					cookies.Clear(writer)
				}
			}
			request = request.WithContext(ctx)
			info.Request = request
			next.ServeHTTP(writer, request)
		})
	}
}

func SessionFromContext(ctx context.Context) (Session, bool) {
	session, ok := ctx.Value(sessionContextKey).(Session)
	return session, ok
}

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
