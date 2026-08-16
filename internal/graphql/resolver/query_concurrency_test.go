package resolver

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestJobsQueryLoadsIndependentMetadataConcurrently(t *testing.T) {
	t.Parallel()

	started := make(chan string, 3)
	release := make(chan struct{})
	var releaseOnce sync.Once
	releaseCalls := func() { releaseOnce.Do(func() { close(release) }) }
	defer releaseCalls()

	reader := &blockingResolverReader{started: started, release: release}
	tasks := &blockingTaskClient{
		taskActionClientStub: taskActionClientStub{},
		started:              started,
		release:              release,
	}
	now := time.Date(2026, time.August, 17, 12, 0, 0, 0, time.UTC)
	sessions := auth.NewSessionManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	token, _, err := sessions.Issue()
	if err != nil {
		t.Fatal(err)
	}
	root := New(Dependencies{
		Sessions: sessions, Users: reader, Projects: reader, Tasks: tasks,
		Now: func() time.Time { return now },
	})
	cookie := &http.Cookie{
		Name: "vbu_session", Value: token, HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	}
	done := make(chan error, 1)
	go withRequestContext(
		t,
		sessions,
		auth.NewSessionCookies(false),
		httptest.NewRecorder(),
		cookie,
		func(ctx context.Context) {
			_, queryErr := (&queryResolver{root}).Tasks(ctx, model.TaskListInput{
				Scope: model.TaskScopeJobs, Page: 1, PageSize: 30,
			})
			done <- queryErr
		},
	)

	seen := make(map[string]bool, 3)
	timer := time.NewTimer(200 * time.Millisecond)
	for len(seen) < 3 {
		select {
		case name := <-started:
			seen[name] = true
		case <-timer.C:
			releaseCalls()
			if queryErr := <-done; queryErr != nil {
				t.Fatalf("Tasks() error = %v", queryErr)
			}
			t.Fatalf("calls did not overlap: started = %v", seen)
		}
	}
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	releaseCalls()
	if queryErr := <-done; queryErr != nil {
		t.Fatalf("Tasks() error = %v", queryErr)
	}
}

type blockingResolverReader struct {
	started chan<- string
	release <-chan struct{}
}

func (reader *blockingResolverReader) CurrentUser(context.Context) (vikunja.User, error) {
	reader.started <- "user"
	<-reader.release
	return vikunja.User{
		ID: 1, Username: "user", Settings: vikunja.UserSettings{Timezone: "UTC", WeekStart: 1},
	}, nil
}

func (reader *blockingResolverReader) Projects(context.Context) ([]vikunja.Project, error) {
	reader.started <- "projects"
	<-reader.release
	return []vikunja.Project{{ID: 7, Title: "Home"}}, nil
}

type blockingTaskClient struct {
	taskActionClientStub
	started chan<- string
	release <-chan struct{}
}

func (client *blockingTaskClient) Labels(context.Context) ([]vikunja.Label, error) {
	client.started <- "labels"
	<-client.release
	return []vikunja.Label{{ID: 4, Title: "job"}}, nil
}
