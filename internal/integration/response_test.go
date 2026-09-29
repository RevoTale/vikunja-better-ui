package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWriteJSONRejectsUnrepresentableDatesBeforeSuccessStatus(t *testing.T) {
	t.Parallel()
	writer := httptest.NewRecorder()
	writeJSON(writer, http.StatusOK, time.Date(10000, time.January, 1, 0, 0, 0, 0, time.UTC))
	if writer.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", writer.Code)
	}
	var response errorResponse
	if err := json.Unmarshal(writer.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Error.Code != "UPSTREAM_UNAVAILABLE" {
		t.Fatalf("response = %#v", response)
	}
}
