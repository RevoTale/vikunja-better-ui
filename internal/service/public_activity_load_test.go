package service

import (
	"testing"
	"time"
)

func TestPublicActivityMaximumDatasetAndScanLimit(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	client := &largeActivity{pages: 1000, now: now}
	cache := NewPublicActivity(client, func() time.Time { return now })
	summary, err := cache.Read(t.Context())
	if err != nil || summary.Total != 100_000 || summary.Days[13].WithDeadlineCount != 75_000 ||
		summary.Days[13].OnTimeCount != 50_000 || client.calls != 1000 || client.users != 1 {
		t.Fatalf("unexpected maximum dataset: summary %+v, error %v, requests %d", summary, err, client.calls+client.users)
	}
	ctx := t.Context()
	for range 1000 {
		if _, readErr := cache.Read(ctx); readErr != nil {
			t.Fatal(readErr)
		}
	}
	if client.calls != 1000 || client.users != 1 {
		t.Fatalf("warm cache repeated upstream requests: %d", client.calls+client.users)
	}
	client = &largeActivity{pages: 1001, now: now}
	summary, err = loadActivity(t.Context(), client, now)
	if err == nil || summary.Total != 0 || client.calls != 1000 {
		t.Fatalf("scan limit returned partial success: total %d, error %v, calls %d", summary.Total, err, client.calls)
	}
}
