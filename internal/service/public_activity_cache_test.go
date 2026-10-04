package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type failingActivity struct{ calls int }

func (s *failingActivity) CurrentUser(context.Context) (vikunja.User, error) {
	s.calls++
	return vikunja.User{}, errors.New("upstream unavailable")
}
func (*failingActivity) ActivityPage(context.Context, vikunja.TaskQuery) (vikunja.ActivityPage, error) {
	return vikunja.ActivityPage{}, errors.New("unexpected tasks request")
}

func TestPublicActivityConcurrentReadersShareRefresh(t *testing.T) {
	t.Parallel()
	client := &activityStub{}
	cache := NewPublicActivity(client, func() time.Time { return time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC) })
	var group sync.WaitGroup
	for range 30 {
		group.Go(func() {
			result, err := cache.Read(t.Context())
			if err != nil || result.Total != 2 {
				t.Errorf("read = %v, %v", result, err)
			}
		})
	}
	group.Wait()
	if client.calls != 1 {
		t.Fatalf("upstream calls = %d", client.calls)
	}
}

func TestPublicActivityFailureCooldownAndCancellation(t *testing.T) {
	t.Parallel()
	now := time.Now()
	client := &failingActivity{}
	cache := NewPublicActivity(client, func() time.Time { return now })
	for range 3 {
		if _, err := cache.Read(t.Context()); err == nil {
			t.Fatal("false success")
		}
	}
	if client.calls != 1 {
		t.Fatal("failure storm bypassed cooldown")
	}
	now = now.Add(30 * time.Second)
	if _, err := cache.Read(t.Context()); err == nil || client.calls != 2 {
		t.Fatal("missing retry")
	}
	cache.gate <- struct{}{}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := cache.Read(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("wait cancellation: %v", err)
	}
	<-cache.gate
}

func TestActivityCalendarBoundariesAndInvalidPriority(t *testing.T) {
	t.Parallel()
	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Date(2026, 10, 25, 0, 0, 0, 0, location)
	end := start.AddDate(0, 0, 1)
	summary := ActivitySummary{Days: [7]ActivityDay{{Date: "2026-10-25"}}}
	instants := []time.Time{start, start.Add(-time.Nanosecond), end.Add(time.Nanosecond), end.Add(-time.Nanosecond)}
	for _, instant := range instants {
		if err := addActivity(&summary, vikunja.ActivityTask{Done: true, DoneAt: instant}, start, end, location); err != nil {
			t.Fatal(err)
		}
	}
	if summary.Total != 2 {
		t.Fatalf("DST boundary count: %d", summary.Total)
	}
	invalid := vikunja.ActivityTask{Done: true, DoneAt: start, Priority: 6}
	if err := addActivity(&summary, invalid, start, end, location); err == nil {
		t.Fatal("invalid priority accepted")
	}
}
