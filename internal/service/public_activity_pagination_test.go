package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type pagedActivity struct {
	activityStub

	pages []int64
	fail  bool
}

func (client *pagedActivity) ActivityPage(_ context.Context, query vikunja.TaskQuery) (vikunja.ActivityPage, error) {
	client.pages = append(client.pages, query.Page)
	if client.fail && query.Page == 2 {
		return vikunja.ActivityPage{}, errors.New("second page unavailable")
	}
	return vikunja.ActivityPage{TotalPages: 2, Items: []vikunja.ActivityTask{{
		Done: true, DoneAt: time.Date(2026, 10, 4, 9, 0, 0, 0, time.UTC), Priority: query.Page,
	}}}, nil
}

func TestActivityPagesAreReducedAndPartialResultsNeverPublished(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	for _, fail := range []bool{false, true} {
		client := &pagedActivity{fail: fail}
		result, err := loadActivity(t.Context(), client, now)
		if len(client.pages) != 2 || client.pages[0] != 1 || client.pages[1] != 2 {
			t.Fatalf("page traversal: %v", client.pages)
		}
		if fail {
			if err == nil || result.Total != 0 {
				t.Fatalf("partial result published: %+v %v", result, err)
			}
		} else if err != nil || result.Total != 2 || result.Priorities[1] != 1 || result.Priorities[2] != 1 {
			t.Fatalf("aggregate: %+v %v", result, err)
		}
	}
}
