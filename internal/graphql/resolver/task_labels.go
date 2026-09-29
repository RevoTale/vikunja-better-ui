package resolver

import (
	"context"
	"errors"
	"strconv"

	"github.com/RevoTale/vikunja-better-ui/internal/concurrent"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func (r *queryResolver) waitForJobLabels(read *concurrent.Future[[]vikunja.Label]) ([]int64, error) {
	if read == nil {
		return nil, nil
	}
	labels, err := read.Wait()
	if err != nil {
		r.logError("resolve job marker labels", err)
		return nil, upstreamClientError(err, "Job markers could not be loaded.")
	}
	return service.ExactLabelIDs(labels, "vbu:job"), nil
}

func (r *queryResolver) TaskLabels(ctx context.Context) ([]*model.Label, error) {
	if _, err := requireSession(ctx); err != nil {
		return nil, err
	}
	labels, err := r.tasks.Labels(ctx)
	if err != nil {
		return nil, upstreamClientError(err, "Labels could not be loaded.")
	}
	result := make([]*model.Label, 0, len(labels))
	for _, label := range labels {
		if !service.IsInternalLabel(label.Title) {
			result = append(result, &model.Label{ID: strconv.FormatInt(label.ID, 10), Title: label.Title})
		}
	}
	return result, nil
}

func (r *mutationResolver) CreateTaskLabel(ctx context.Context, csrfToken string, title string) (*model.Label, error) {
	if _, err := r.requireCSRF(ctx, csrfToken); err != nil {
		return nil, err
	}
	label, err := service.ResolveUserLabel(ctx, r.tasks, title)
	if err != nil {
		return nil, labelClientError(err)
	}
	return &model.Label{ID: strconv.FormatInt(label.ID, 10), Title: label.Title}, nil
}

func parseLabelIDs(values []string) ([]int64, error) {
	if values == nil {
		return nil, nil
	}
	if len(values) > 50 {
		return nil, labelClientError(service.ErrInvalidLabels)
	}
	ids := make([]int64, 0, len(values))
	for _, value := range values {
		id, err := parsePositiveID(value)
		if err != nil {
			return nil, labelClientError(service.ErrInvalidLabels)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func labelClientError(err error) error {
	if errors.Is(err, service.ErrInvalidLabels) {
		return clientError("VALIDATION_FAILED", service.ErrInvalidLabels.Error())
	}
	return upstreamClientError(err, "Labels could not be saved. Reload labels before retrying.")
}

func (r *queryResolver) selectedTaskLabel(ctx context.Context, id *string, scope model.TaskScope) ([]int64, error) {
	if id == nil {
		return nil, nil
	}
	if scope != model.TaskScopeToday && scope != model.TaskScopeUnscheduled {
		return nil, clientError("VALIDATION_FAILED", "Label filtering is supported on Today and No date.")
	}
	ids, err := parseLabelIDs([]string{*id})
	if err != nil {
		return nil, err
	}
	labels, err := r.tasks.Labels(ctx)
	if err != nil {
		return nil, labelClientError(err)
	}
	if _, err := service.SelectTaskLabels(labels, ids); err != nil {
		return nil, labelClientError(err)
	}
	return ids, nil
}
