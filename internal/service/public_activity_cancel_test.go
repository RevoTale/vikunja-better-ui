package service

import (
	"context"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type pausedActivity struct {
	activityStub

	started chan struct{}
	resume  chan struct{}
}

func (client *pausedActivity) CurrentUser(ctx context.Context) (vikunja.User, error) {
	close(client.started)
	select {
	case <-client.resume:
		if err := ctx.Err(); err != nil {
			return vikunja.User{}, err
		}
		return client.activityStub.CurrentUser(ctx)
	case <-ctx.Done():
		return vikunja.User{}, ctx.Err()
	}
}

func TestActivityRefreshSurvivesFirstVisitorDisconnect(t *testing.T) {
	t.Parallel()
	client := &pausedActivity{started: make(chan struct{}), resume: make(chan struct{})}
	cache := NewPublicActivity(client, func() time.Time { return time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC) })
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	finished := make(chan error, 1)
	go func() {
		_, err := cache.Read(ctx)
		finished <- err
	}()
	<-client.started
	cancel()
	close(client.resume)
	if err := <-finished; err != nil {
		t.Fatalf("visitor cancellation poisoned shared refresh: %v", err)
	}
	result, err := cache.Read(t.Context())
	if err != nil || result.Total != 3 || client.calls != 1 {
		t.Fatalf("cached result: %+v, %v, calls %d", result, err, client.calls)
	}
}
