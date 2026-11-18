package auth

import (
	"testing"
	"time"
)

const (
	firstPeer  = "192.0.2.1"
	secondPeer = "192.0.2.2"
	thirdPeer  = "192.0.2.3"
)

func TestLoginLimiterBlocksAfterFiveFailures(t *testing.T) {
	t.Parallel()
	now := time.Now()
	limiter := NewLoginLimiter(func() time.Time { return now })
	for range loginFailureLimit {
		attemptLogin(t, limiter, firstPeer, LoginRejected)
	}
	if limiter.Begin(firstPeer) {
		t.Fatal("accepted an attempt after five failures")
	}
	attemptLogin(t, limiter, secondPeer, LoginAccepted)
	now = now.Add(loginFailureWindow)
	attemptLogin(t, limiter, firstPeer, LoginAccepted)
}

func TestLoginLimiterSuccessClearsFailures(t *testing.T) {
	t.Parallel()
	limiter := NewLoginLimiter(time.Now)
	for range loginFailureLimit - 1 {
		attemptLogin(t, limiter, firstPeer, LoginRejected)
	}
	attemptLogin(t, limiter, firstPeer, LoginAccepted)
	for range loginFailureLimit {
		attemptLogin(t, limiter, firstPeer, LoginRejected)
	}
}

func TestLoginLimiterExpiresIdleEntries(t *testing.T) {
	t.Parallel()
	now := time.Now()
	limiter := newLoginLimiter(func() time.Time { return now }, 2)
	attemptLogin(t, limiter, firstPeer, LoginRejected)
	now = now.Add(loginIdleExpiry + time.Second)
	attemptLogin(t, limiter, secondPeer, LoginRejected)
	if len(limiter.buckets) != 1 || limiter.buckets[secondPeer] == nil {
		t.Fatal("an idle address outlived expiration")
	}
}

func TestLoginLimiterEvictsLeastRecentlyUsedEntry(t *testing.T) {
	t.Parallel()
	limiter := newLoginLimiter(time.Now, 2)
	attemptLogin(t, limiter, firstPeer, LoginRejected)
	attemptLogin(t, limiter, secondPeer, LoginRejected)
	attemptLogin(t, limiter, firstPeer, LoginUnavailable)
	attemptLogin(t, limiter, thirdPeer, LoginRejected)
	if limiter.buckets[secondPeer] != nil || limiter.buckets[firstPeer] == nil || limiter.buckets[thirdPeer] == nil {
		t.Fatal("expected only the least recently used idle peer to be evicted")
	}
}

func TestLoginLimiterBoundsReservationsAndKeepsActivePeers(t *testing.T) {
	t.Parallel()
	now := time.Now()
	limiter := newLoginLimiter(func() time.Time { return now }, 2)
	for range loginFailureLimit {
		if !limiter.Begin(firstPeer) {
			t.Fatal("refused a pending attempt below the limit")
		}
	}
	if limiter.Begin(firstPeer) {
		t.Fatal("accepted excess simultaneous attempts")
	}
	if !limiter.Begin(secondPeer) {
		t.Fatal("second peer could not reserve an attempt")
	}
	now = now.Add(loginIdleExpiry + time.Second)
	if limiter.Begin(thirdPeer) || limiter.Begin(firstPeer) {
		t.Fatal("active attempts were evicted or expired")
	}
	limiter.Finish(firstPeer, LoginAccepted)
	if !limiter.Begin(firstPeer) || limiter.Begin(firstPeer) {
		t.Fatal("a successful login must release only its own reservation")
	}
	for range loginFailureLimit {
		limiter.Finish(firstPeer, LoginUnavailable)
	}
	attemptLogin(t, limiter, thirdPeer, LoginAccepted)
	limiter.Finish(secondPeer, LoginUnavailable)
	if len(limiter.buckets) != 0 {
		t.Fatal("unavailable and successful attempts without failures retained peer state")
	}
}

func attemptLogin(t *testing.T, limiter *LoginLimiter, peer string, outcome LoginOutcome) {
	t.Helper()
	if !limiter.Begin(peer) {
		t.Fatal("unexpectedly denied login for", peer)
	}
	limiter.Finish(peer, outcome)
}
