package service

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type largeActivity struct {
	pages int64
	users int
	calls int
	now   time.Time
}

func (client *largeActivity) CurrentUser(context.Context) (vikunja.User, error) {
	client.users++
	return vikunja.User{Settings: vikunja.UserSettings{Timezone: "UTC"}}, nil
}

func (client *largeActivity) ActivityPage(_ context.Context, query vikunja.TaskQuery) (vikunja.ActivityPage, error) {
	client.calls++
	items := make([]vikunja.ActivityTask, query.PerPage)
	for index := range items {
		items[index] = vikunja.ActivityTask{Done: true, DoneAt: client.now, Priority: int64(index % 6)}
		switch index % 4 {
		case 0:
			items[index].DueDate = client.now.Add(time.Hour)
		case 1:
			items[index].DueDate = client.now
		case 2:
			items[index].DueDate = client.now.Add(-time.Hour)
		}
	}
	return vikunja.ActivityPage{Items: items, TotalPages: client.pages}, nil
}

func BenchmarkPublicActivityScan(b *testing.B) {
	for _, pages := range []int64{100, 1000} {
		b.Run(fmt.Sprintf("tasks_%d", pages*100), func(b *testing.B) {
			client := &largeActivity{pages: pages, now: time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)}
			b.ReportAllocs()
			for b.Loop() {
				if _, err := loadActivity(b.Context(), client, client.now); err != nil {
					b.Fatal(err)
				}
			}
			b.ReportMetric(float64(client.calls+client.users)/float64(b.N), "upstream_calls/refresh")
			b.ReportMetric(float64(reflect.TypeFor[ActivitySummary]().Size()), "aggregate_B")
		})
	}
}

func BenchmarkPublicActivityCacheHit(b *testing.B) {
	client := &largeActivity{pages: 1000, now: time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)}
	cache := NewPublicActivity(client, func() time.Time { return client.now })
	if _, err := cache.Read(b.Context()); err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	for b.Loop() {
		if _, err := cache.Read(b.Context()); err != nil {
			b.Fatal(err)
		}
	}
	if client.calls != 1000 || client.users != 1 {
		b.Fatalf("cache repeated upstream requests: users %d, pages %d", client.users, client.calls)
	}
}
