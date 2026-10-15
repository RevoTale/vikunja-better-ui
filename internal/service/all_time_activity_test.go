package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type allTimeStub struct {
	calls atomic.Int64
	tasks []vikunja.ActivityTask
	err   error
}

func (*allTimeStub) CurrentUser(context.Context) (vikunja.User, error) {
	return vikunja.User{Settings: vikunja.UserSettings{Timezone: "Europe/Kyiv"}}, nil
}

func (stub *allTimeStub) ActivityPage(_ context.Context, query vikunja.TaskQuery) (vikunja.ActivityPage, error) {
	stub.calls.Add(1)
	if query.Filter == "" || query.IncludeCommentCount {
		return vikunja.ActivityPage{}, errors.New("unsafe activity query")
	}
	return vikunja.ActivityPage{Items: stub.tasks, TotalPages: 1}, stub.err
}

func TestAllTimeActivityWeeksAndCache(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)
	sunday := time.Date(2026, 10, 25, 21, 30, 0, 0, time.UTC) // Sunday 23:30 after Kyiv DST.
	monday := sunday.Add(time.Hour)
	stub := &allTimeStub{tasks: []vikunja.ActivityTask{
		{Done: true, DoneAt: sunday, DueDate: sunday, Priority: 3},
		{Done: true, DoneAt: monday, DueDate: sunday, Priority: 1},
		{Done: true, DoneAt: monday, Priority: 2},
		{Done: true, DoneAt: monday, Labels: []vikunja.Label{{Title: skippedLabel}}},
		{Done: false, DoneAt: monday},
		{Done: true, DoneAt: now.Add(time.Hour)},
	}}
	cache := NewPublicAllTimeActivity(stub, func() time.Time { return now })
	result, err := cache.Read(t.Context())
	if err != nil || len(result.Weeks) != 2 || result.Total != 3 {
		t.Fatalf("summary=%+v err=%v", result, err)
	}
	if result.Weeks[0].Date != "2026-10-19" || result.Weeks[0].OnTimeCount != 1 ||
		result.Weeks[1].Date != "2026-10-26" || result.Weeks[1].WithDeadlineCount != 1 {
		t.Fatalf("wrong week or deadline cohort: %+v", result.Weeks)
	}
	if _, err = cache.Read(t.Context()); err != nil || stub.calls.Load() != 1 {
		t.Fatalf("warm cache repeated scan: %v", err)
	}
	now = now.Add(time.Hour)
	if _, err = cache.Read(t.Context()); err != nil || stub.calls.Load() != 2 {
		t.Fatalf("hour expiry did not refresh: %v", err)
	}
}

func TestAllTimeActivityRateLimitAndFailureCooldown(t *testing.T) {
	t.Parallel()
	now := time.Now()
	stub := &allTimeStub{err: errors.New("offline")}
	cache := NewPublicAllTimeActivity(stub, func() time.Time { return now })
	for range 20 {
		if _, err := cache.Read(t.Context()); err == nil {
			t.Fatal("failed scan returned success")
		}
	}
	if _, err := cache.Read(t.Context()); !errors.Is(err, ErrActivityBusy) || stub.calls.Load() != 1 {
		t.Fatalf("rate/cooldown failed: %v, calls=%d", err, stub.calls.Load())
	}
	now = now.Add(time.Minute)
	_, _ = cache.Read(t.Context())
	if stub.calls.Load() != 1 {
		t.Fatal("failure caused another expensive scan before cooldown")
	}
}
