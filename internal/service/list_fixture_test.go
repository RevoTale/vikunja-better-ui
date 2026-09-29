package service

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type listClientStub struct {
	mu      sync.Mutex
	pages   []vikunja.TaskPage
	queries []vikunja.TaskQuery
	errAt   int
	err     error
}

func (client *listClientStub) TasksPage(_ context.Context, query vikunja.TaskQuery) (vikunja.TaskPage, error) {
	client.mu.Lock()
	defer client.mu.Unlock()
	client.queries = append(client.queries, query)
	callNumber := len(client.queries)
	if client.errAt > 0 && callNumber == client.errAt {
		return vikunja.TaskPage{}, client.err
	}
	return client.pages[callNumber-1], nil
}

type concurrentPageClient struct {
	started chan<- int64
	release <-chan struct{}
}

type unifiedJobsClient struct {
	mu        sync.Mutex
	active    vikunja.TaskPage
	completed vikunja.TaskPage
	queries   []vikunja.TaskQuery
	started   chan<- string
	release   <-chan struct{}
}

func (client *unifiedJobsClient) TasksPage(_ context.Context, query vikunja.TaskQuery) (vikunja.TaskPage, error) {
	client.mu.Lock()
	client.queries = append(client.queries, query)
	client.mu.Unlock()
	completed := strings.HasPrefix(query.Filter, "done = true")
	if client.started != nil {
		status := "active"
		if completed {
			status = "completed"
		}
		client.started <- status
		<-client.release
	}
	if completed {
		return client.completed, nil
	}
	return client.active, nil
}

func (client *unifiedJobsClient) assertReadBothStatuses(t *testing.T) {
	t.Helper()
	client.mu.Lock()
	defer client.mu.Unlock()
	if len(client.queries) != 2 {
		t.Fatalf("queries = %#v", client.queries)
	}
	if strings.HasPrefix(client.queries[0].Filter, "done = true") ==
		strings.HasPrefix(client.queries[1].Filter, "done = true") {
		t.Fatalf("queries = %#v", client.queries)
	}
}

func (client *concurrentPageClient) TasksPage(_ context.Context, query vikunja.TaskQuery) (vikunja.TaskPage, error) {
	if query.Page > 1 {
		client.started <- query.Page
		<-client.release
	}
	return vikunja.TaskPage{
		Items: []vikunja.Task{{ID: query.Page, DueDate: time.Now().Add(-time.Hour)}},
		Total: 3, Page: query.Page, PerPage: 1000, TotalPages: 3,
	}, nil
}
