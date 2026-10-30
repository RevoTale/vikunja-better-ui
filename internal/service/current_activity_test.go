package service

import (
	"context"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type currentActivityClient struct {
	pageCalls atomic.Int32
	gate      <-chan struct{}
}

func (client *currentActivityClient) CurrentUser(context.Context) (vikunja.User, error) {
	return vikunja.User{Settings: vikunja.UserSettings{Timezone: "UTC"}}, nil
}

func (client *currentActivityClient) ActivityPage(context.Context, vikunja.TaskQuery) (vikunja.ActivityPage, error) {
	client.pageCalls.Add(1)
	if client.gate != nil {
		<-client.gate
	}
	return vikunja.ActivityPage{TotalPages: 1}, nil
}

func TestCurrentActivityDoesNotReusePublicSnapshotCache(t *testing.T) {
	t.Parallel()
	client := &currentActivityClient{}
	now := func() time.Time { return time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC) }
	reader := NewCurrentActivity(client, now)
	for range 2 {
		if _, err := reader.Read(t.Context()); err != nil {
			t.Fatal(err)
		}
	}
	if client.pageCalls.Load() != 2 {
		t.Fatalf("activity page calls = %d, want 2 fresh reads", client.pageCalls.Load())
	}
}

func TestCurrentAllTimeActivityDoesNotReusePublicSnapshotCache(t *testing.T) {
	t.Parallel()
	client := &currentActivityClient{}
	now := func() time.Time { return time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC) }
	reader := NewCurrentAllTimeActivity(client, now)
	for range 2 {
		if _, err := reader.Read(t.Context()); err != nil {
			t.Fatal(err)
		}
	}
	if client.pageCalls.Load() != 2 {
		t.Fatalf("activity page calls = %d, want 2 fresh reads", client.pageCalls.Load())
	}
}

func TestCurrentActivityCoalescesOnlyOverlappingReads(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		client := &currentActivityClient{gate: release}
		reader := NewCurrentActivity(client, time.Now)
		for range 2 {
			go func() {
				if _, err := reader.Read(t.Context()); err != nil {
					t.Errorf("read activity: %v", err)
				}
			}()
		}
		// Both reads must be blocked before the upstream response can finish.
		synctest.Wait()
		close(release)
		synctest.Wait()
		if client.pageCalls.Load() != 1 {
			t.Fatalf("overlapping page calls = %d, want 1", client.pageCalls.Load())
		}
	})
}
