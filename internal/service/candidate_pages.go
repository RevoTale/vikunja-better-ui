package service

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	"golang.org/x/sync/errgroup"
)

func sameCandidatePagination(page, first vikunja.TaskPage) bool {
	return page.Total == first.Total && page.TotalPages == first.TotalPages && page.PerPage == first.PerPage
}

// The caller owns the shared concurrency limit. Visits may run in parallel.
func scheduleCandidatePages(
	ctx context.Context, group *errgroup.Group, client taskListClient,
	query vikunja.TaskQuery, totalPages int64, visit func(int64, vikunja.TaskPage) error,
) {
	for number := firstRemainingPage; number <= totalPages; number++ {
		if ctx.Err() != nil {
			break
		}
		group.Go(func() error {
			pageQuery := query
			pageQuery.Page = number
			page, err := client.TasksPage(ctx, pageQuery)
			if err != nil {
				return err
			}
			return visit(number-firstRemainingPage, page)
		})
	}
}

func loadRemainingCandidatePages(ctx context.Context, client taskListClient, sets []candidatePageSet) error {
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(maxPageConcurrency)
	for index := range sets {
		set := &sets[index]
		set.pages = make([]vikunja.TaskPage, max(set.first.TotalPages-1, 0))
		scheduleCandidatePages(groupCtx, group, client, set.query, set.first.TotalPages,
			func(index int64, page vikunja.TaskPage) error {
				set.pages[index] = page
				return nil
			})
	}
	if err := group.Wait(); err != nil {
		return err
	}
	return ctx.Err()
}

func loadRemainingTaskPages(
	ctx context.Context,
	client taskListClient,
	query vikunja.TaskQuery,
	totalPages int64,
) ([]vikunja.TaskPage, error) {
	sets := []candidatePageSet{{query: query, first: vikunja.TaskPage{TotalPages: totalPages}}}
	if err := loadRemainingCandidatePages(ctx, client, sets); err != nil {
		return nil, err
	}
	return sets[0].pages, nil
}
