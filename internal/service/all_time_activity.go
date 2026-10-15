package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const (
	allTimeMaxWeeks       = 5200
	calendarWeekDays      = 7
	allTimeFailureTTL     = 5 * time.Minute
	allTimeMaxReaders     = 16
	allTimeReadsPerSecond = 20
)

// ErrActivityBusy rejects excess readers without allocating a visitor map or an unbounded queue.
var ErrActivityBusy = errors.New("public activity is busy")

// AllTimeActivitySummary retains weekly anonymous counts, never task records.
type AllTimeActivitySummary struct {
	Weeks       []ActivityWeek
	Priorities  [activityPriorities]int
	Total       int
	GeneratedAt time.Time
	RefreshAt   time.Time
	Timezone    string
}

// ActivityWeek keeps at most six anonymous priority cohorts for local filtering.
type ActivityWeek struct {
	ActivityDay

	Priorities [activityPriorities]ActivityPriorityCounts
}

// ActivityPriorityCounts preserves the denominator for weighted on-time percentages.
type ActivityPriorityCounts struct {
	Count             int
	WithDeadlineCount int
	OnTimeCount       int
}

// PublicAllTimeActivity owns one bounded, opt-in aggregate and a process-wide reader budget.
type PublicAllTimeActivity struct {
	client   activityClient
	now      func() time.Time
	gate     chan struct{}
	readers  chan struct{}
	value    AllTimeActivitySummary
	err      error
	expires  time.Time
	window   time.Time
	requests int
}

// NewPublicAllTimeActivity creates a lazy one-hour cache with at most sixteen pending readers.
func NewPublicAllTimeActivity(client activityClient, now func() time.Time) *PublicAllTimeActivity {
	return &PublicAllTimeActivity{client: client, now: now,
		gate: make(chan struct{}, 1), readers: make(chan struct{}, allTimeMaxReaders)}
}

// Read coalesces scans and rejects overload; failures never expose a stale successful snapshot.
func (cache *PublicAllTimeActivity) Read(ctx context.Context) (AllTimeActivitySummary, error) {
	if err := ctx.Err(); err != nil {
		return AllTimeActivitySummary{}, err
	}
	select {
	case cache.readers <- struct{}{}:
	default:
		return AllTimeActivitySummary{}, ErrActivityBusy
	}
	defer func() { <-cache.readers }()
	select {
	case cache.gate <- struct{}{}:
	case <-ctx.Done():
		return AllTimeActivitySummary{}, ctx.Err()
	}
	defer func() { <-cache.gate }()
	now := cache.now()
	window := now.Truncate(time.Second)
	if !cache.window.Equal(window) {
		cache.window, cache.requests = window, 0
	}
	cache.requests++
	if cache.requests > allTimeReadsPerSecond {
		return AllTimeActivitySummary{}, ErrActivityBusy
	}
	if now.Before(cache.expires) {
		return cache.value, cache.err
	}
	bounded, cancel := context.WithTimeout(context.WithoutCancel(ctx), activityTimeout)
	defer cancel()
	cache.value, cache.err = loadAllTimeActivity(bounded, cache.client, now)
	cache.expires = cache.now().Add(activityTTL)
	if cache.err != nil {
		cache.expires = cache.now().Add(allTimeFailureTTL)
	}
	cache.value.RefreshAt = cache.expires
	return cache.value, cache.err
}

func loadAllTimeActivity(ctx context.Context, client activityClient, now time.Time) (AllTimeActivitySummary, error) {
	user, err := client.CurrentUser(ctx)
	if err != nil {
		return AllTimeActivitySummary{}, err
	}
	location, err := time.LoadLocation(user.Settings.Timezone)
	if err != nil || user.Settings.Timezone == "" {
		return AllTimeActivitySummary{}, errors.New("invalid activity timezone")
	}
	summary := AllTimeActivitySummary{GeneratedAt: now, Timezone: location.String()}
	weeks := make(map[time.Time]ActivityWeek)
	query := vikunja.TaskQuery{PerPage: activityPageSize, FilterTimezone: location.String(),
		Filter: fmt.Sprintf("done = true && done_at > '0001-01-01T00:00:00Z' && done_at <= '%s'",
			now.Format(time.RFC3339)),
	}
	for query.Page = 1; query.Page <= activityMaxPages; query.Page++ {
		page, readErr := client.ActivityPage(ctx, query)
		if readErr != nil {
			return AllTimeActivitySummary{}, readErr
		}
		for _, task := range page.Items {
			if err := addAllTimeActivity(&summary, weeks, task, now, location); err != nil {
				return AllTimeActivitySummary{}, err
			}
		}
		if query.Page >= page.TotalPages {
			return fillActivityWeeks(summary, weeks, now, location)
		}
	}
	return AllTimeActivitySummary{}, errors.New("all-time activity scan limit exceeded")
}
