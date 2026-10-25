package service

import (
	"context"
	"time"
)

// CurrentActivity loads a fresh bounded 14-day aggregate for an authenticated request.
type CurrentActivity struct {
	client activityClient
	now    func() time.Time
	flight currentActivityFlight[ActivitySummary]
}

// NewCurrentActivity creates an uncached authenticated activity reader.
func NewCurrentActivity(client activityClient, now func() time.Time) *CurrentActivity {
	return &CurrentActivity{client: client, now: now}
}

// Read returns current data without reusing the anonymous one-hour snapshot.
func (reader *CurrentActivity) Read(ctx context.Context) (ActivitySummary, error) {
	return reader.flight.read(ctx, func() (ActivitySummary, error) {
		bounded, cancel := context.WithTimeout(ctx, activityTimeout)
		defer cancel()
		summary, err := loadActivity(bounded, reader.client, reader.now())
		summary.RefreshAt = summary.GeneratedAt
		return summary, err
	})
}

// CurrentAllTimeActivity loads a fresh bounded all-time aggregate for an authenticated request.
type CurrentAllTimeActivity struct {
	client activityClient
	now    func() time.Time
	flight currentActivityFlight[AllTimeActivitySummary]
}

// NewCurrentAllTimeActivity creates an uncached authenticated all-time reader.
func NewCurrentAllTimeActivity(client activityClient, now func() time.Time) *CurrentAllTimeActivity {
	return &CurrentAllTimeActivity{client: client, now: now}
}

// Read returns current data without reusing the anonymous one-hour snapshot.
func (reader *CurrentAllTimeActivity) Read(ctx context.Context) (AllTimeActivitySummary, error) {
	return reader.flight.read(ctx, func() (AllTimeActivitySummary, error) {
		bounded, cancel := context.WithTimeout(ctx, activityTimeout)
		defer cancel()
		summary, err := loadAllTimeActivity(bounded, reader.client, reader.now())
		summary.RefreshAt = summary.GeneratedAt
		return summary, err
	})
}
