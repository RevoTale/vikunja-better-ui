package auth

import (
	"container/list"
	"sync"
	"time"
)

const (
	loginFailureLimit  = 5
	loginFailureWindow = 15 * time.Minute
	loginIdleExpiry    = 30 * time.Minute
	loginBucketLimit   = 4096
)

// LoginOutcome determines how a completed login affects the peer's failure history.
type LoginOutcome uint8

// An unavailable upstream or canceled request only releases its reserved attempt.
const (
	LoginUnavailable LoginOutcome = iota
	LoginRejected
	LoginAccepted
)

// LoginLimiter bounds pending and failed login attempts per peer and retained addresses in memory.
type LoginLimiter struct {
	mu         sync.Mutex
	now        func() time.Time
	maxBuckets int
	buckets    map[string]*loginBucket
	idle       list.List // Most recently accessed idle bucket first. Active buckets cannot be evicted.
}

type loginBucket struct {
	address    string
	failures   []time.Time
	pending    int
	lastAccess time.Time
	idleNode   *list.Element
}

// NewLoginLimiter creates a concurrent limiter using the supplied clock.
func NewLoginLimiter(now func() time.Time) *LoginLimiter {
	return newLoginLimiter(now, loginBucketLimit)
}

func newLoginLimiter(now func() time.Time, maxBuckets int) *LoginLimiter {
	return &LoginLimiter{now: now, maxBuckets: maxBuckets, buckets: make(map[string]*loginBucket)}
}

// Begin reserves one attempt before checking the credential. Each accepted reservation needs one Finish.
func (limiter *LoginLimiter) Begin(address string) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	now := limiter.now()
	limiter.expireIdle(now)
	bucket := limiter.buckets[address]
	if bucket == nil {
		if len(limiter.buckets) >= limiter.maxBuckets {
			oldest := limiter.idle.Back()
			if oldest == nil {
				return false
			}
			limiter.removeIdle(oldest)
		}
		bucket = &loginBucket{address: address}
		limiter.buckets[address] = bucket
	}
	pruneFailures(bucket, now)
	if bucket.pending+len(bucket.failures) >= loginFailureLimit {
		if bucket.idleNode != nil {
			bucket.lastAccess = now
			limiter.idle.MoveToFront(bucket.idleNode)
		}
		return false
	}
	if bucket.idleNode != nil {
		limiter.idle.Remove(bucket.idleNode)
		bucket.idleNode = nil
	}
	bucket.pending++
	return true
}

// Finish releases a reservation, recording only genuine credential failures.
func (limiter *LoginLimiter) Finish(address string, outcome LoginOutcome) {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	bucket := limiter.buckets[address]
	now := limiter.now()
	bucket.pending--
	pruneFailures(bucket, now)
	switch outcome {
	case LoginAccepted:
		bucket.failures = nil
	case LoginRejected:
		bucket.failures = append(bucket.failures, now)
	case LoginUnavailable:
	}
	if bucket.pending > 0 {
		return
	}
	if len(bucket.failures) == 0 {
		delete(limiter.buckets, address)
		return
	}
	bucket.lastAccess = now
	bucket.idleNode = limiter.idle.PushFront(bucket)
}

func (limiter *LoginLimiter) expireIdle(now time.Time) {
	for node := limiter.idle.Back(); node != nil; node = limiter.idle.Back() {
		//nolint:forcetypeassert // Only Finish inserts login buckets into the idle list.
		bucket := node.Value.(*loginBucket)
		if now.Sub(bucket.lastAccess) <= loginIdleExpiry {
			return
		}
		limiter.removeIdle(node)
	}
}

func (limiter *LoginLimiter) removeIdle(node *list.Element) {
	//nolint:forcetypeassert // Only Finish inserts login buckets into the idle list.
	bucket := limiter.idle.Remove(node).(*loginBucket)
	delete(limiter.buckets, bucket.address)
}

func pruneFailures(bucket *loginBucket, now time.Time) {
	cutoff := now.Add(-loginFailureWindow)
	firstActive := 0
	for firstActive < len(bucket.failures) && !bucket.failures[firstActive].After(cutoff) {
		firstActive++
	}
	bucket.failures = bucket.failures[firstActive:]
}
