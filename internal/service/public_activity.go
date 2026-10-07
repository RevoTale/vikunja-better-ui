package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const (
	activityDays       = 14
	activityPriorities = 6
	activityTTL        = 10 * time.Minute
	activityRetryDelay = 30 * time.Second
	activityTimeout    = 20 * time.Second
	activityPageSize   = 100
	activityMaxPages   = 1000
)

type activityClient interface {
	CurrentUser(context.Context) (vikunja.User, error)
	ActivityPage(context.Context, vikunja.TaskQuery) (vikunja.ActivityPage, error)
}

// ActivityDay is an anonymous calendar-day count.
type ActivityDay struct {
	Date  string
	Count int
}

// ActivitySummary contains only fixed-size, public completion totals.
type ActivitySummary struct {
	Days        [activityDays]ActivityDay
	Priorities  [activityPriorities]int
	Total       int
	GeneratedAt time.Time
	RefreshAt   time.Time
	Timezone    string
}

// PublicActivity coalesces refreshes and caches only one small aggregate, never tasks.
type PublicActivity struct {
	client  activityClient
	now     func() time.Time
	gate    chan struct{}
	value   ActivitySummary
	err     error
	expires time.Time
}

// NewPublicActivity creates an empty, lazily populated ten-minute aggregate cache.
func NewPublicActivity(client activityClient, now func() time.Time) *PublicActivity {
	return &PublicActivity{client: client, now: now, gate: make(chan struct{}, 1)}
}

// Read serves a shared snapshot; failed refreshes have a short cooldown, not stale success.
func (cache *PublicActivity) Read(ctx context.Context) (ActivitySummary, error) {
	if err := ctx.Err(); err != nil {
		return ActivitySummary{}, err
	}
	select {
	case cache.gate <- struct{}{}:
	case <-ctx.Done():
		return ActivitySummary{}, ctx.Err()
	}
	defer func() { <-cache.gate }()
	if cache.now().Before(cache.expires) {
		return cache.value, cache.err
	}
	// A visitor leaving must not poison the shared snapshot or its retry cooldown.
	bounded, cancel := context.WithTimeout(context.WithoutCancel(ctx), activityTimeout)
	defer cancel()
	cache.value, cache.err = loadActivity(bounded, cache.client, cache.now())
	if cache.err != nil {
		cache.expires = cache.now().Add(activityRetryDelay)
	} else {
		cache.expires = cache.now().Add(activityTTL)
		cache.value.RefreshAt = cache.expires
	}
	return cache.value, cache.err
}

func loadActivity(ctx context.Context, client activityClient, now time.Time) (ActivitySummary, error) {
	user, err := client.CurrentUser(ctx)
	if err != nil {
		return ActivitySummary{}, err
	}
	location, err := time.LoadLocation(user.Settings.Timezone)
	if err != nil || user.Settings.Timezone == "" {
		return ActivitySummary{}, errors.New("invalid activity timezone")
	}
	local := now.In(location)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location).AddDate(0, 0, 1-activityDays)
	summary := ActivitySummary{GeneratedAt: now, Timezone: location.String()}
	for index := range summary.Days {
		summary.Days[index].Date = start.AddDate(0, 0, index).Format(time.DateOnly)
	}
	query := vikunja.TaskQuery{PerPage: activityPageSize, FilterTimezone: location.String(),
		Filter: fmt.Sprintf("done = true && done_at >= '%s' && done_at <= '%s'",
			start.Format(time.RFC3339), now.Format(time.RFC3339)),
	}
	for query.Page = 1; query.Page <= activityMaxPages; query.Page++ {
		page, readErr := client.ActivityPage(ctx, query)
		if readErr != nil {
			return ActivitySummary{}, readErr
		}
		for _, task := range page.Items {
			if err := addActivity(&summary, task, start, now, location); err != nil {
				return ActivitySummary{}, err
			}
		}
		if query.Page >= page.TotalPages {
			return summary, nil
		}
	}
	return ActivitySummary{}, errors.New("activity scan limit exceeded")
}

func addActivity(
	summary *ActivitySummary, task vikunja.ActivityTask, start, now time.Time, location *time.Location,
) error {
	if !task.Done || task.DoneAt.Before(start) || task.DoneAt.After(now) || hasLabel(task.Labels, skippedLabel) {
		return nil
	}
	if task.Priority < 0 || task.Priority >= activityPriorities {
		return vikunja.ErrRejectedResponse
	}
	date := task.DoneAt.In(location).Format(time.DateOnly)
	for index := range summary.Days {
		if summary.Days[index].Date == date {
			summary.Days[index].Count++
			summary.Priorities[task.Priority]++
			summary.Total++
			break
		}
	}
	return nil
}
