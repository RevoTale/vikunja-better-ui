package integration

import (
	"encoding/json"
	"net/http"
)

func writeError(writer http.ResponseWriter, status int, code string, message string) {
	writeJSON(writer, status, errorResponse{Error: apiError{Code: code, Message: message}})
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	encoded, err := json.Marshal(value)
	if err != nil {
		status = http.StatusBadGateway
		encoded = []byte(`{"error":{"code":"UPSTREAM_UNAVAILABLE",` +
			`"message":"Vikunja could not provide the requested jobs."}}`)
	}
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	// Headers are committed; a disconnected client cannot receive a second response.
	_, _ = writer.Write(append(encoded, '\n'))
}
