package auth

import (
	"testing"
	"time"
)

func TestLoginLimiterBlocksAfterFiveFailures(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 9, 30, 0, 0, time.UTC)
	limiter := newLoginLimiter(func() time.Time { return now }, 4096)

	for attempt := 1; attempt <= 5; attempt++ {
		if !limiter.Allow("192.0.2.1") {
			t.Fatalf("Allow() = false before failure %d", attempt)
		}
		limiter.RecordFailure("192.0.2.1")
	}
	if limiter.Allow("192.0.2.1") {
		t.Fatal("Allow() = true after five failures")
	}
	if !limiter.Allow("192.0.2.2") {
		t.Fatal("Allow() blocked an unrelated address")
	}

	now = now.Add(15*time.Minute + time.Second)
	if !limiter.Allow("192.0.2.1") {
		t.Fatal("Allow() = false after failure window elapsed")
	}
}

func TestLoginLimiterSuccessClearsFailures(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 9, 30, 0, 0, time.UTC)
	limiter := newLoginLimiter(func() time.Time { return now }, 4096)
	for range 5 {
		limiter.RecordFailure("192.0.2.1")
	}

	limiter.RecordSuccess("192.0.2.1")
	if !limiter.Allow("192.0.2.1") {
		t.Fatal("Allow() = false after successful-login reset")
	}
}

func TestLoginLimiterExpiresIdleEntries(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 9, 30, 0, 0, time.UTC)
	limiter := newLoginLimiter(func() time.Time { return now }, 2)
	limiter.RecordFailure("192.0.2.1")

	now = now.Add(30*time.Minute + time.Second)
	limiter.RecordFailure("192.0.2.2")

	if got := limiter.size(); got != 1 {
		t.Fatalf("size() = %d, want 1 after idle expiry", got)
	}
}

func TestLoginLimiterEvictsLeastRecentlyUsedEntry(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 9, 30, 0, 0, time.UTC)
	limiter := newLoginLimiter(func() time.Time { return now }, 2)
	limiter.RecordFailure("192.0.2.1")
	now = now.Add(time.Second)
	limiter.RecordFailure("192.0.2.2")
	now = now.Add(time.Second)
	if !limiter.Allow("192.0.2.1") {
		t.Fatal("Allow() unexpectedly blocked first address")
	}
	now = now.Add(time.Second)
	limiter.RecordFailure("192.0.2.3")

	if limiter.has("192.0.2.2") {
		t.Fatal("least recently used address was not evicted")
	}
	if !limiter.has("192.0.2.1") || !limiter.has("192.0.2.3") {
		t.Fatal("recent entries were evicted")
	}
}
