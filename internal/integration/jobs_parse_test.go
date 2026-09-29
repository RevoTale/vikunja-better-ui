package integration

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestParseJobsRequestAcceptsExplicitActiveStatus(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet, "/integrations/v1/jobs?status=active", nil,
	)
	request.Header.Set("Authorization", "Bearer tk_glance")
	input, err := parseJobsRequest(request)
	if err != nil {
		t.Fatalf("parseJobsRequest() error = %v", err)
	}
	if input.status != jobsStatusActive || !input.completedFrom.IsZero() || !input.completedBefore.IsZero() {
		t.Fatalf("input = %#v", input)
	}
}

func TestParseJobsRequestDefaultsUnifiedSort(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequestWithContext(
		t.Context(), http.MethodGet,
		"/integrations/v1/jobs?status=all&completedFrom=2026-08-24T00%3A00%3A00%2B03%3A00"+
			"&completedBefore=2026-08-31T00%3A00%3A00%2B03%3A00",
		nil,
	)
	request.Header.Set("Authorization", "Bearer tk_glance")
	input, err := parseJobsRequest(request)
	if err != nil {
		t.Fatalf("parseJobsRequest() error = %v", err)
	}
	if input.status != jobsStatusAll || input.sortBy != jobsSortStartAt || input.sortOrder != jobsSortAscending {
		t.Fatalf("input = %#v", input)
	}
}
