package web

import (
	"mime"
	"net/http"
	"net/url"
)

const maxGraphQLBodyBytes int64 = 64 << 10

func GraphQLBoundary(allowedOrigin *url.URL) func(http.Handler) http.Handler {
	expectedOrigin := allowedOrigin.Scheme + "://" + allowedOrigin.Host
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.Method != http.MethodPost {
				writer.Header().Set("Allow", http.MethodPost)
				http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			if request.Header.Get("Origin") != expectedOrigin {
				http.Error(writer, "request origin is not allowed", http.StatusForbidden)
				return
			}
			if !isApplicationJSON(request.Header.Get("Content-Type")) {
				http.Error(writer, "content type must be application/json", http.StatusUnsupportedMediaType)
				return
			}
			if request.ContentLength > maxGraphQLBodyBytes {
				http.Error(writer, "request body is too large", http.StatusRequestEntityTooLarge)
				return
			}
			request.Body = http.MaxBytesReader(writer, request.Body, maxGraphQLBodyBytes)
			next.ServeHTTP(writer, request)
		})
	}
}

func isApplicationJSON(value string) bool {
	mediaType, _, err := mime.ParseMediaType(value)
	return err == nil && mediaType == "application/json"
}
