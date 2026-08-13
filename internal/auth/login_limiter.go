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

type LoginLimiter struct {
	mu         sync.Mutex
	now        func() time.Time
	maxBuckets int
	buckets    map[string]*loginBucket
	recency    *list.List
}

type loginBucket struct {
	address     string
	failures    []time.Time
	lastAccess  time.Time
	recencyNode *list.Element
}

func NewLoginLimiter(now func() time.Time) *LoginLimiter {
	return newLoginLimiter(now, loginBucketLimit)
}

func newLoginLimiter(now func() time.Time, maxBuckets int) *LoginLimiter {
	return &LoginLimiter{
		now:        now,
		maxBuckets: maxBuckets,
		buckets:    make(map[string]*loginBucket, maxBuckets),
		recency:    list.New(),
	}
}

func (limiter *LoginLimiter) Allow(address string) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	now := limiter.now()
	limiter.expireIdle(now)
	bucket, ok := limiter.buckets[address]
	if !ok {
		return true
	}

	limiter.touch(bucket, now)
	pruneFailures(bucket, now)
	return len(bucket.failures) < loginFailureLimit
}

func (limiter *LoginLimiter) RecordFailure(address string) {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	now := limiter.now()
	limiter.expireIdle(now)
	bucket, ok := limiter.buckets[address]
	if !ok {
		limiter.makeRoom()
		bucket = &loginBucket{address: address}
		bucket.recencyNode = limiter.recency.PushFront(bucket)
		limiter.buckets[address] = bucket
	}

	limiter.touch(bucket, now)
	pruneFailures(bucket, now)
	bucket.failures = append(bucket.failures, now)
}

func (limiter *LoginLimiter) RecordSuccess(address string) {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	limiter.remove(address)
}

func (limiter *LoginLimiter) touch(bucket *loginBucket, now time.Time) {
	bucket.lastAccess = now
	limiter.recency.MoveToFront(bucket.recencyNode)
}

func (limiter *LoginLimiter) expireIdle(now time.Time) {
	for node := limiter.recency.Back(); node != nil; {
		previous := node.Prev()
		bucket := node.Value.(*loginBucket)
		if now.Sub(bucket.lastAccess) <= loginIdleExpiry {
			break
		}
		limiter.remove(bucket.address)
		node = previous
	}
}

func (limiter *LoginLimiter) makeRoom() {
	if len(limiter.buckets) < limiter.maxBuckets {
		return
	}

	oldest := limiter.recency.Back()
	if oldest == nil {
		return
	}
	limiter.remove(oldest.Value.(*loginBucket).address)
}

func (limiter *LoginLimiter) remove(address string) {
	bucket, ok := limiter.buckets[address]
	if !ok {
		return
	}
	limiter.recency.Remove(bucket.recencyNode)
	delete(limiter.buckets, address)
}

func pruneFailures(bucket *loginBucket, now time.Time) {
	cutoff := now.Add(-loginFailureWindow)
	firstActive := 0
	for firstActive < len(bucket.failures) && !bucket.failures[firstActive].After(cutoff) {
		firstActive++
	}
	if firstActive > 0 {
		bucket.failures = append(bucket.failures[:0], bucket.failures[firstActive:]...)
	}
}

func (limiter *LoginLimiter) size() int {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	return len(limiter.buckets)
}

func (limiter *LoginLimiter) has(address string) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	_, ok := limiter.buckets[address]
	return ok
}
