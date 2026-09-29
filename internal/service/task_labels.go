package service

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const maxTaskLabels = 50

// ErrInvalidLabels rejects inaccessible labels and the internal namespace.
var ErrInvalidLabels = errors.New("choose accessible ordinary labels; vbu: labels are reserved")

// IsInternalLabel reserves the normalized vbu: namespace, not the ordinary job label.
func IsInternalLabel(title string) bool {
	title = strings.ToLower(strings.TrimSpace(title))
	return strings.HasPrefix(title, "vbu:")
}

func loadTaskLabels(ctx context.Context, client markerClient, ids []int64) ([]vikunja.Label, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	available, err := client.Labels(ctx)
	if err != nil {
		return nil, err
	}
	return SelectTaskLabels(available, ids)
}

// SelectTaskLabels validates accessible ordinary IDs and deduplicates the selection.
func SelectTaskLabels(available []vikunja.Label, ids []int64) ([]vikunja.Label, error) {
	if len(ids) > maxTaskLabels {
		return nil, ErrInvalidLabels
	}
	selected := make([]vikunja.Label, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, ErrInvalidLabels
		}
		if hasLabelID(selected, id) {
			continue
		}
		found := false
		for _, label := range available {
			if label.ID == id && !IsInternalLabel(label.Title) {
				selected = append(selected, label)
				found = true
				break
			}
		}
		if !found {
			return nil, ErrInvalidLabels
		}
	}
	return selected, nil
}

// ResolveUserLabel reuses the smallest matching ID or creates an ordinary label.
func ResolveUserLabel(ctx context.Context, client markerClient, title string) (vikunja.Label, error) {
	title = strings.TrimSpace(title)
	if title == "" || utf8.RuneCountInString(title) > 250 || IsInternalLabel(title) {
		return vikunja.Label{}, ErrInvalidLabels
	}
	labels, err := client.Labels(ctx)
	if err != nil {
		return vikunja.Label{}, err
	}
	// Sequential retries reuse the smallest ID for an exact matching title.
	var existing vikunja.Label
	for _, label := range labels {
		if label.Title == title && (existing.ID == 0 || label.ID < existing.ID) {
			existing = label
		}
	}
	if existing.ID > 0 {
		return existing, nil
	}
	return client.CreateLabel(ctx, vikunja.LabelWrite{Title: title})
}

type taskLabelClient interface {
	AttachLabel(context.Context, int64, int64) error
	DetachLabel(context.Context, int64, int64) error
}

func updateOrdinaryLabels(
	ctx context.Context,
	client taskLabelClient,
	task vikunja.Task,
	desired []vikunja.Label,
) error {
	for _, label := range desired {
		if !hasLabelID(task.Labels, label.ID) {
			if err := client.AttachLabel(ctx, task.ID, label.ID); err != nil {
				return err
			}
		}
	}
	for _, label := range task.Labels {
		if !IsInternalLabel(label.Title) && !hasLabelID(desired, label.ID) {
			if err := client.DetachLabel(ctx, task.ID, label.ID); err != nil {
				return err
			}
		}
	}
	return nil
}

func ordinaryLabelsMatch(actual, desired []vikunja.Label) bool {
	for _, label := range desired {
		if !hasLabelID(actual, label.ID) {
			return false
		}
	}
	for _, label := range actual {
		if !IsInternalLabel(label.Title) && !hasLabelID(desired, label.ID) {
			return false
		}
	}
	return true
}
