package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type activityStub struct {
	calls int
	query vikunja.TaskQuery
}

func (*activityStub) CurrentUser(context.Context) (vikunja.User, error) {
	return vikunja.User{Settings: vikunja.UserSettings{Timezone: "Europe/Kyiv"}}, nil
}

func (s *activityStub) ActivityPage(_ context.Context, q vikunja.TaskQuery) (vikunja.ActivityPage, error) {
	s.calls++
	s.query = q
	return vikunja.ActivityPage{Items: []vikunja.ActivityTask{
		{Done: true, DoneAt: time.Date(2026, 9, 20, 21, 0, 0, 0, time.UTC), Priority: 2},
		{Done: true, DoneAt: time.Date(2026, 9, 20, 20, 59, 0, 0, time.UTC), Priority: 2},
		{Done: true, DoneAt: time.Date(2026, 10, 4, 9, 0, 0, 0, time.UTC), Priority: 3},
		{Done: true, DoneAt: time.Date(2026, 10, 4, 10, 0, 0, 0, time.UTC), Priority: 0},
		{Done: true, DoneAt: time.Date(2026, 10, 4, 11, 0, 0, 0, time.UTC), Labels: []vikunja.Label{{Title: skippedLabel}}},
	}, TotalPages: 1}, nil
}

func TestPublicActivityCachesOnlyAggregates(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	upstream := &activityStub{}
	cache := NewPublicActivity(upstream, func() time.Time { return now })
	result, err := cache.Read(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 3 || result.Days[0].Date != "2026-09-21" || result.Days[0].Count != 1 ||
		result.Days[13].Count != 2 || result.Priorities[2] != 1 || result.Priorities[3] != 1 {
		t.Fatalf("unexpected aggregate: %+v", result)
	}
	if _, err = cache.Read(t.Context()); err != nil || upstream.calls != 1 {
		t.Fatalf("cache miss: %v, %d", err, upstream.calls)
	}
	now = now.Add(10 * time.Minute)
	if _, err = cache.Read(t.Context()); err != nil || upstream.calls != 2 {
		t.Fatalf("refresh: %v, %d", err, upstream.calls)
	}
	if !strings.Contains(upstream.query.Filter, "2026-09-21T00:00:00+03:00") || upstream.query.IncludeCommentCount {
		t.Fatal("missing bounded filter")
	}
}
