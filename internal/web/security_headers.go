package web

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
)

type cspNonceContextKey struct{}

func SecurityHeaders(production bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			nonce, err := newCSPNonce()
			if err != nil {
				http.Error(writer, "security policy unavailable", http.StatusInternalServerError)
				return
			}
			writer.Header().Set("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'nonce-"+nonce+"'; style-src-attr 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
			writer.Header().Set("Referrer-Policy", "no-referrer")
			writer.Header().Set("X-Content-Type-Options", "nosniff")
			writer.Header().Set("X-Frame-Options", "DENY")
			if production {
				writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}
			next.ServeHTTP(writer, request.WithContext(context.WithValue(request.Context(), cspNonceContextKey{}, nonce)))
		})
	}
}

func newCSPNonce() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func cspNonce(ctx context.Context) string {
	nonce, _ := ctx.Value(cspNonceContextKey{}).(string)
	return nonce
}
