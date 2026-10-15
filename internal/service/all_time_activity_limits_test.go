package service

import (
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestAllTimeActivityLargeDatasetIsOnePagedScan(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	client := &largeActivity{pages: 1000, now: now}
	cache := NewPublicAllTimeActivity(client, func() time.Time { return now })
	result, err := cache.Read(t.Context())
	if err != nil || result.Total != 100_000 || len(result.Weeks) != 1 ||
		result.Weeks[0].OnTimeCount != 50_000 || result.Weeks[0].WithDeadlineCount != 75_000 {
		t.Fatalf("unexpected large aggregate: %+v, %v", result, err)
	}
	var prioritiesTotal, deadlineTotal, onTimeTotal int
	for _, counts := range result.Weeks[0].Priorities {
		prioritiesTotal += counts.Count
		deadlineTotal += counts.WithDeadlineCount
		onTimeTotal += counts.OnTimeCount
	}
	if prioritiesTotal != result.Total || deadlineTotal != 75_000 || onTimeTotal != 50_000 {
		t.Fatalf("priority cohorts do not reconcile: %d, %d, %d", prioritiesTotal, deadlineTotal, onTimeTotal)
	}
	for range 10 {
		if _, err := cache.Read(t.Context()); err != nil {
			t.Fatal(err)
		}
	}
	if client.calls != 1000 || client.users != 1 {
		t.Fatalf("upstream amplification: %d tasks pages, %d users", client.calls, client.users)
	}
	t.Log("100,000 completions: 1000 page calls + 1 user; cached reads: 0 extra calls")
}

func TestAllTimeActivityRejectsPartialAndExcessiveHistory(t *testing.T) {
	t.Parallel()
	now := time.Now()
	client := &largeActivity{pages: 1001, now: now}
	if result, err := loadAllTimeActivity(t.Context(), client, now); err == nil || result.Total != 0 {
		t.Fatal("page limit exposed partial success")
	}
	old := &allTimeStub{tasks: []vikunja.ActivityTask{{Done: true, DoneAt: now.AddDate(-101, 0, 0)}}}
	if result, err := loadAllTimeActivity(t.Context(), old, now); err == nil || result.Total != 0 {
		t.Fatal("unbounded week history accepted")
	}
}

func TestAllTimeActivityFillsMissingWeeksAndRecovers(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 1, 5, 12, 0, 0, 0, time.UTC)
	stub := &allTimeStub{tasks: []vikunja.ActivityTask{{Done: true, DoneAt: now.AddDate(0, 0, -21)}}}
	cache := NewPublicAllTimeActivity(stub, func() time.Time { return now })
	result, err := cache.Read(t.Context())
	if err != nil || len(result.Weeks) != 4 || result.Weeks[1].Count != 0 || result.Weeks[3].Count != 0 {
		t.Fatalf("missing week gap: %+v, %v", result, err)
	}
	stub.err = errors.New("offline")
	now = now.Add(time.Hour)
	if result, err = cache.Read(t.Context()); err == nil || result.Total != 0 {
		t.Fatal("expired private data returned as stale success")
	}
	stub.err = nil
	now = now.Add(5 * time.Minute)
	if _, err = cache.Read(t.Context()); err != nil {
		t.Fatalf("failure cooldown did not recover: %v", err)
	}
}

func BenchmarkAllTimeActivityScan(b *testing.B) {
	client := &largeActivity{pages: 1000, now: time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)}
	b.ReportAllocs()
	for b.Loop() {
		if _, err := loadAllTimeActivity(b.Context(), client, client.now); err != nil {
			b.Fatal(err)
		}
	}
	b.ReportMetric(float64(client.calls+client.users)/float64(b.N), "upstream_calls/refresh")
}
