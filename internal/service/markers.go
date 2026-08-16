package service

import (
	"context"
	"fmt"
	"slices"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type markerClient interface {
	Labels(context.Context) ([]vikunja.Label, error)
	CreateLabel(context.Context, vikunja.LabelWrite) (vikunja.Label, error)
}

func ResolveMarker(ctx context.Context, client markerClient, title string) (vikunja.Label, error) {
	if !isMarkerTitle(title) {
		return vikunja.Label{}, fmt.Errorf("unknown marker label")
	}

	labels, err := client.Labels(ctx)
	if err != nil {
		return vikunja.Label{}, err
	}
	if label, ok := lowestExactLabel(labels, title); ok {
		return label, nil
	}

	if _, err := client.CreateLabel(ctx, vikunja.LabelWrite{Title: title}); err != nil {
		return vikunja.Label{}, err
	}
	labels, err = client.Labels(ctx)
	if err != nil {
		return vikunja.Label{}, err
	}
	label, ok := lowestExactLabel(labels, title)
	if !ok {
		return vikunja.Label{}, vikunja.ErrRejectedResponse
	}
	return label, nil
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
		title == fixedDueTimeLabel
}
