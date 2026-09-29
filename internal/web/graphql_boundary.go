// Package web serves frontend assets and enforces HTTP security boundaries.
package web

import (
	"mime"
	"net/http"
	"net/url"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

// Includes JSON escaping overhead for a 100,000-byte rich-text comment.
const maxGraphQLBodyBytes int64 = 1 << 20

// MaxGraphQLUploadBytes includes a media file and multipart/GraphQL envelope overhead.
const MaxGraphQLUploadBytes = service.MaxMediaBytes + maxGraphQLBodyBytes

// GraphQLBoundary restricts methods, origin, body size, and authenticated multipart uploads.
func GraphQLBoundary(allowedOrigin *url.URL, sessions *auth.SessionManager) func(http.Handler) http.Handler {
	expectedOrigin := allowedOrigin.Scheme + "://" + allowedOrigin.Host
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			writer.Header().Set("Cache-Control", "private, no-store")
			if request.Method != http.MethodPost {
				writer.Header().Set("Allow", http.MethodPost)
				http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			if request.Header.Get("Origin") != expectedOrigin {
				http.Error(writer, "request origin is not allowed", http.StatusForbidden)
				return
			}
			limit := graphQLBodyLimit(writer, request, sessions)
			if limit == 0 {
				return
			}
			if request.ContentLength > limit {
				http.Error(writer, "request body is too large", http.StatusRequestEntityTooLarge)
				return
			}
			request.Body = http.MaxBytesReader(writer, request.Body, limit)
			next.ServeHTTP(writer, request)
		})
	}
}

func graphQLBodyLimit(w http.ResponseWriter, r *http.Request, sessions *auth.SessionManager) int64 {
	if isApplicationJSON(r.Header.Get("Content-Type")) {
		return maxGraphQLBodyBytes
	}
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "multipart/form-data" {
		http.Error(w, "unsupported content type", http.StatusUnsupportedMediaType)
		return 0
	}
	session, ok := auth.SessionFromContext(r.Context())
	if !ok {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return 0
	}
	if sessions == nil || !sessions.VerifyCSRF(session, r.Header.Get("X-Csrf-Token")) {
		http.Error(w, "invalid CSRF token", http.StatusForbidden)
		return 0
	}
	// gqlgen uses Content-Length to choose bounded memory versus temporary disk.
	if r.ContentLength <= 0 {
		http.Error(w, "upload length is required", http.StatusLengthRequired)
		return 0
	}
	return MaxGraphQLUploadBytes
}

func isApplicationJSON(value string) bool {
	mediaType, _, err := mime.ParseMediaType(value)
	return err == nil && mediaType == "application/json"
}
