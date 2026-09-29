package vikunja

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestClientCoalescesOnlyConcurrentCurrentUserRequests(t *testing.T) {
	t.Parallel()

	assertConcurrentRequestsCoalesced(t, `{
		"id": 7,
		"username": "test-user",
		"settings": {"timezone": "UTC", "week_start": 1}
	}`, func(ctx context.Context, client *Client) error {
		_, err := client.CurrentUser(ctx)
		return err
	})
}

func TestClientCoalescesOnlyConcurrentProjectRequests(t *testing.T) {
	t.Parallel()

	assertConcurrentRequestsCoalesced(t, `{
		"items": [{"id": 7, "title": "Home"}],
		"total": 1,
		"page": 1,
		"per_page": 1000,
		"total_pages": 1
	}`, func(ctx context.Context, client *Client) error {
		_, err := client.Projects(ctx)
		return err
	})
}

func TestClientCoalescesOnlyConcurrentLabelRequests(t *testing.T) {
	t.Parallel()

	assertConcurrentRequestsCoalesced(t, `{
		"items": [{"id": 4, "title": "job"}],
		"total": 1,
		"page": 1,
		"per_page": 1000,
		"total_pages": 1
	}`, func(ctx context.Context, client *Client) error {
		_, err := client.Labels(ctx)
		return err
	})
}

func TestClientCanceledCallerDoesNotCancelSharedMetadataRead(t *testing.T) {
	t.Parallel()

	started := make(chan struct{}, 1)
	release := make(chan struct{})
	var requestCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requestCount.Add(1)
		started <- struct{}{}
		<-release
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{
			"id": 7,
			"username": "test-user",
			"settings": {"timezone": "UTC", "week_start": 1}
		}`))
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	leaderContext, cancelLeader := context.WithCancel(t.Context())
	leaderDone := make(chan error, 1)
	go func() {
		_, callErr := client.CurrentUser(leaderContext)
		leaderDone <- callErr
	}()
	<-started

	waiterStarted := make(chan struct{})
	waiterDone := make(chan error, 1)
	go func() {
		close(waiterStarted)
		_, callErr := client.CurrentUser(t.Context())
		waiterDone <- callErr
	}()
	<-waiterStarted
	select {
	case <-started:
		close(release)
		t.Fatal("waiting caller started another upstream request")
	case <-time.After(50 * time.Millisecond):
	}
	cancelLeader()
	if callErr := <-leaderDone; !errors.Is(callErr, context.Canceled) {
		t.Fatalf("canceled caller error = %v", callErr)
	}
	close(release)
	if callErr := <-waiterDone; callErr != nil {
		t.Fatalf("waiting caller error = %v", callErr)
	}
	if requests := requestCount.Load(); requests != 1 {
		t.Fatalf("upstream requests = %d, want 1", requests)
	}
}

func TestClientCancelsSharedMetadataReadAfterAllCallersLeave(t *testing.T) {
	t.Parallel()

	started := make(chan struct{})
	requestCanceled := make(chan struct{})
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		close(started)
		select {
		case <-request.Context().Done():
			close(requestCanceled)
		case <-release:
		}
	}))
	t.Cleanup(func() {
		close(release)
		server.Close()
	})

	client := testClient(t, server.URL, "test-token")
	callerContext, cancelCaller := context.WithCancel(t.Context())
	callerDone := make(chan error, 1)
	go func() {
		_, callErr := client.CurrentUser(callerContext)
		callerDone <- callErr
	}()
	<-started
	cancelCaller()
	if callErr := <-callerDone; !errors.Is(callErr, context.Canceled) {
		t.Fatalf("canceled caller error = %v", callErr)
	}

	select {
	case <-requestCanceled:
	case <-time.After(250 * time.Millisecond):
		t.Fatal("upstream request continued after its final caller left")
	}
}

func assertConcurrentRequestsCoalesced(
	t *testing.T,
	response string,
	call func(context.Context, *Client) error,
) {
	t.Helper()

	const callers = 8
	requests := make(chan struct{}, callers+1)
	release := make(chan struct{})
	var requestCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requestCount.Add(1)
		requests <- struct{}{}
		<-release
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(response))
	}))
	t.Cleanup(server.Close)

	client := testClient(t, server.URL, "test-token")
	start := make(chan struct{})
	errors := make(chan error, callers)
	for range callers {
		go func() {
			<-start
			errors <- call(t.Context(), client)
		}()
	}
	close(start)

	select {
	case <-requests:
	case <-time.After(time.Second):
		close(release)
		t.Fatal("no upstream request started")
	}
	select {
	case <-requests:
		close(release)
		t.Fatal("concurrent calls started more than one upstream request")
	case <-time.After(100 * time.Millisecond):
	}
	close(release)
	for range callers {
		if callErr := <-errors; callErr != nil {
			t.Fatalf("concurrent call error = %v", callErr)
		}
	}
	if requests := requestCount.Load(); requests != 1 {
		t.Fatalf("upstream requests = %d, want 1", requests)
	}

	if err := call(t.Context(), client); err != nil {
		t.Fatalf("later call error = %v", err)
	}
	if requests := requestCount.Load(); requests != 2 {
		t.Fatalf("upstream requests after later call = %d, want 2", requests)
	}
}
