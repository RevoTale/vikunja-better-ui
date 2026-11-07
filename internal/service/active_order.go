package service

import (
	"cmp"
	"slices"
	"strings"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

// ActiveWorkOrder controls the order of tasks whose planning window contains now.
type ActiveWorkOrder struct {
	Sort         ActiveWorkSort
	RevisitFirst bool
}

// ActiveWorkSort selects the key and direction within each Revisit group.
type ActiveWorkSort string

// Active work supports chronological and ordinary-label order in both directions.
const (
	ActiveEndAsc    ActiveWorkSort = "END_ASC"
	ActiveEndDesc   ActiveWorkSort = "END_DESC"
	ActiveStartAsc  ActiveWorkSort = "START_ASC"
	ActiveStartDesc ActiveWorkSort = "START_DESC"
	ActiveLabelAsc  ActiveWorkSort = "LABEL_ASC"
	ActiveLabelDesc ActiveWorkSort = "LABEL_DESC"
)

func compareActiveFinish(left, right taskListCandidate) int {
	if result := activeWindowEnd(left.Task).Compare(activeWindowEnd(right.Task)); result != 0 {
		return result
	}
	return comparePriorityTitleID(left, right)
}

func orderActiveWork(items []taskListCandidate, order ActiveWorkOrder) {
	// Resolve label titles once per task regardless of how many comparisons the sort makes.
	var labels map[*vikunja.Task]string
	if order.Sort == ActiveLabelAsc || order.Sort == ActiveLabelDesc {
		labels = make(map[*vikunja.Task]string, len(items))
		for _, item := range items {
			labels[item.Task] = firstActiveLabel(item.Task.Labels)
		}
	}
	compare := func(left, right taskListCandidate) int {
		var result int
		switch order.Sort {
		case ActiveLabelAsc, ActiveLabelDesc:
			result = compareActiveLabels(labels[left.Task], labels[right.Task], order.Sort)
		case ActiveStartAsc:
			result = left.Task.StartDate.Compare(right.Task.StartDate)
		case ActiveStartDesc:
			result = right.Task.StartDate.Compare(left.Task.StartDate)
		case ActiveEndDesc:
			result = activeWindowEnd(right.Task).Compare(activeWindowEnd(left.Task))
		case ActiveEndAsc:
		}
		if result != 0 {
			return result
		}
		return compareActiveFinish(left, right)
	}
	// Each group has a total order ending in task ID, so partitioning need not be stable.
	pinned := 0
	if order.RevisitFirst {
		for i := range items {
			if hasLabel(items[i].Task.Labels, "Revisit") {
				items[pinned], items[i] = items[i], items[pinned]
				pinned++
			}
		}
	}
	slices.SortFunc(items[:pinned], compare)
	slices.SortFunc(items[pinned:], compare)
}

func firstActiveLabel(labels []vikunja.Label) string {
	var first string
	for _, label := range labels {
		title := strings.ToLower(strings.TrimSpace(label.Title))
		if title != "" && !IsInternalLabel(title) && (first == "" || title < first) {
			first = title
		}
	}
	return first
}

func compareActiveLabels(left, right string, sort ActiveWorkSort) int {
	switch {
	case left == right:
		return 0
	case left == "":
		return 1
	case right == "":
		return -1
	case sort == ActiveLabelDesc:
		return cmp.Compare(right, left)
	default:
		return cmp.Compare(left, right)
	}
}
