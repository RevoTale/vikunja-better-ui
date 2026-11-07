package service

import (
	"context"
	"errors"
	"slices"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type markerClient interface {
	Labels(context.Context) ([]vikunja.Label, error)
	CreateLabel(context.Context, vikunja.LabelWrite) (vikunja.Label, error)
}

// ResolveMarker resolves the canonical lowest-ID internal marker, rereading after creation.
func ResolveMarker(ctx context.Context, client markerClient, title string) (vikunja.Label, error) {
	lookup := markerLookup{client: client}
	return lookup.resolve(ctx, title)
}

// markerLookup shares one label catalogue within a marker-resolution phase only.
// Every label creation refreshes it before canonical IDs are selected.
type markerLookup struct {
	client markerClient
	labels []vikunja.Label
	loaded bool
}

func (lookup *markerLookup) resolve(ctx context.Context, title string) (vikunja.Label, error) {
	if !isMarkerTitle(title) {
		return vikunja.Label{}, errors.New("unknown marker label")
	}

	if !lookup.loaded {
		if err := lookup.refresh(ctx); err != nil {
			return vikunja.Label{}, err
		}
	}
	if label, ok := lowestExactLabel(lookup.labels, title); ok {
		return label, nil
	}

	if _, err := lookup.client.CreateLabel(ctx, vikunja.LabelWrite{Title: title}); err != nil {
		return vikunja.Label{}, err
	}
	if err := lookup.refresh(ctx); err != nil {
		return vikunja.Label{}, err
	}
	label, ok := lowestExactLabel(lookup.labels, title)
	if !ok {
		return vikunja.Label{}, vikunja.ErrRejectedResponse
	}
	return label, nil
}

func (lookup *markerLookup) refresh(ctx context.Context) error {
	labels, err := lookup.client.Labels(ctx)
	lookup.labels, lookup.loaded = labels, err == nil
	return err
}

func lowestExactLabel(labels []vikunja.Label, title string) (vikunja.Label, bool) {
	var selected vikunja.Label
	for _, label := range labels {
		if label.Title == title && (selected.ID == 0 || label.ID < selected.ID) {
			selected = label
		}
	}
	return selected, selected.ID > 0
}

// ExactLabelIDs returns the positive IDs for labels with the exact title.
func ExactLabelIDs(labels []vikunja.Label, title string) []int64 {
	result := make([]int64, 0)
	for _, label := range labels {
		if label.ID > 0 && label.Title == title {
			result = append(result, label.ID)
		}
	}
	slices.Sort(result)
	return result
}

func isMarkerTitle(title string) bool {
	return title == jobLabel || title == dateOnlyLabel || title == recurrenceHistoryLabel || title == skippedLabel ||
		title == fixedDueTimeLabel || title == recurringAvailabilityLabel
}
