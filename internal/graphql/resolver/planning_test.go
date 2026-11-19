package resolver

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestTodayTaskCountUsesPlanningPredicateAndRejectsPartialData(t *testing.T) {
	t.Parallel()
	_, err := (&queryResolver{New(Dependencies{})}).TodayTaskCount(t.Context())
	assertErrorCode(t, err, "UNAUTHENTICATED")
	for _, partial := range []bool{false, true} {
		t.Run("partial="+strconv.FormatBool(partial), func(t *testing.T) {
			t.Parallel()
			root, sessions, session, cookie := taskActionResolver(t, &taskActionClientStub{})
			now := root.now()
			root.tasks = &planningCountStub{partial: partial, items: []vikunja.Task{
				{ID: 1, EndDate: now.Add(time.Hour)},
				{ID: 2, StartDate: now.Add(-time.Hour), EndDate: now.AddDate(0, 1, 0)},
				{ID: 3, EndDate: now, DueDate: now},
			}}
			withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
				count, err := (&queryResolver{root}).TodayTaskCount(ctx)
				if partial {
					assertErrorCode(t, err, "UPSTREAM_PARTIAL")
				} else if err != nil || count != 2 {
					t.Fatalf("count=%d err=%v", count, err)
				}
			})
		})
	}
}

func TestTodayRejectsActiveWorkOrdering(t *testing.T) {
	t.Parallel()
	root, sessions, session, cookie := taskActionResolver(t, &taskActionClientStub{})
	withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
		_, err := (&queryResolver{root}).Tasks(ctx, model.TaskListInput{Scope: model.TaskScopeToday,
			ActiveOrder: &model.ActiveWorkOrderInput{RevisitFirst: true}})
		assertErrorCode(t, err, "VALIDATION_FAILED")
	})
}

func TestActiveWorkTaskCountUsesOnlyAuthenticatedTaskReads(t *testing.T) {
	t.Parallel()
	_, err := (&queryResolver{New(Dependencies{})}).ActiveWorkTaskCount(t.Context())
	assertErrorCode(t, err, "UNAUTHENTICATED")

	root, sessions, session, cookie := taskActionResolver(t, &taskActionClientStub{})
	root.users, root.projects = nil, nil
	now := root.now()
	root.tasks = &planningCountStub{items: []vikunja.Task{
		{ID: 1, StartDate: now, EndDate: now.Add(time.Hour)},
		{ID: 2, StartDate: now, DueDate: now.Add(time.Hour)},
	}}
	withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
		count, countErr := (&queryResolver{root}).ActiveWorkTaskCount(ctx)
		if countErr != nil || count != 1 {
			t.Fatalf("count=%d err=%v", count, countErr)
		}
		root.tasks = &countClientStub{err: &vikunja.Error{Status: 403}}
		_, countErr = (&queryResolver{root}).ActiveWorkTaskCount(ctx)
		assertErrorCode(t, countErr, "FORBIDDEN")
	})
}

func TestPlanningPeriodValidatesDatesAndTimezone(t *testing.T) {
	t.Parallel()
	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	from, through := model.LocalDate("2026-10-25"), model.LocalDate("2026-10-25")
	input := model.TaskListInput{Scope: model.TaskScopePeriod, From: &from, Through: &through}
	start, end, err := planningPeriod(input, location)
	if err != nil || end.Sub(start) != 25*time.Hour {
		t.Fatalf("range=%v %v, %v", start, end, err)
	}
	input.Scope = model.TaskScopeToday
	_, _, err = planningPeriod(input, location)
	assertErrorCode(t, err, "VALIDATION_FAILED")
	input.Scope, input.Through = model.TaskScopePeriod, nil
	_, _, err = planningPeriod(input, location)
	assertErrorCode(t, err, "VALIDATION_FAILED")
}

type planningCountStub struct {
	taskActionClientStub

	items   []vikunja.Task
	partial bool
}

func (client *planningCountStub) TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error) {
	total := int64(len(client.items))
	if client.partial {
		total++
	}
	return vikunja.TaskPage{Items: client.items, Total: total, TotalPages: 1, Page: 1, PerPage: 1000}, nil
}
