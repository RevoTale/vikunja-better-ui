package service

import (
	"context"
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestCreateLabeledTaskKeepsCreatedIDOnAttachmentFailure(t *testing.T) {
	t.Parallel()
	client := &createClientStub{
		labels:           []vikunja.Label{{ID: 4, Title: "work"}},
		created:          vikunja.Task{ID: 12},
		attachErrByLabel: map[int64]error{4: errors.New("unavailable")},
	}
	result, err := CreateLabeledTask(context.Background(), client, 7, vikunja.TaskWrite{}, nil, []int64{4})
	if err != nil || result.Task.ID != 12 || result.LabelError == nil || client.createTaskCalls != 1 {
		t.Fatalf("result=%#v err=%v writes=%d", result, err, client.createTaskCalls)
	}
}

func TestCreateLabeledTaskValidatesBeforeWriting(t *testing.T) {
	t.Parallel()
	client := &createClientStub{labels: []vikunja.Label{{ID: 4, Title: "vbu:job"}}}
	_, err := CreateLabeledTask(context.Background(), client, 7, vikunja.TaskWrite{}, nil, []int64{4})
	if !errors.Is(err, ErrInvalidLabels) || client.createTaskCalls != 0 {
		t.Fatalf("err=%v writes=%d", err, client.createTaskCalls)
	}
}

func TestResolveUserLabelReusesExactTitleOnRetry(t *testing.T) {
	t.Parallel()
	client := &createClientStub{}
	first, err := ResolveUserLabel(context.Background(), client, " work ")
	if err != nil {
		t.Fatal(err)
	}
	second, err := ResolveUserLabel(context.Background(), client, "work")
	if err != nil || first.ID != second.ID || len(client.labels) != 1 {
		t.Fatalf("first=%v second=%v err=%v", first, second, err)
	}
	for _, title := range []string{"", "VBU:JOB", " VBU:future "} {
		if _, err := ResolveUserLabel(context.Background(), client, title); !errors.Is(err, ErrInvalidLabels) {
			t.Fatalf("title=%q err=%v", title, err)
		}
	}
}

func TestOrdinaryLabelUpdatesPreserveMarkers(t *testing.T) {
	t.Parallel()
	client := &labelChangeStub{}
	task := vikunja.Task{
		ID:     1,
		Labels: []vikunja.Label{{ID: 2, Title: "vbu:job"}, {ID: 3, Title: "vbu:future"}, {ID: 4, Title: "job"}},
	}
	want := []vikunja.Label{{ID: 5, Title: "new"}}
	if err := updateOrdinaryLabels(t.Context(), client, task, want); err != nil {
		t.Fatal(err)
	}
	if len(client.attached) != 1 || client.attached[0] != 5 || len(client.detached) != 1 || client.detached[0] != 4 {
		t.Fatalf("changes = %#v", client)
	}
	if !ordinaryLabelsMatch([]vikunja.Label{{ID: 2, Title: "vbu:job"}, {ID: 5, Title: "new"}}, want) {
		t.Fatal("internal markers affected comparison")
	}
}

type labelChangeStub struct{ attached, detached []int64 }

func (c *labelChangeStub) AttachLabel(_ context.Context, _ int64, id int64) error {
	c.attached = append(c.attached, id)
	return nil
}
func (c *labelChangeStub) DetachLabel(_ context.Context, _ int64, id int64) error {
	c.detached = append(c.detached, id)
	return nil
}

func TestOrdinaryLabelsRejectReservedAndUnknownIDs(t *testing.T) {
	t.Parallel()
	available := []vikunja.Label{
		{ID: 1, Title: "work"},
		{ID: 2, Title: "job"},
		{ID: 3, Title: "vbu:future-marker"},
		{ID: 4, Title: "work"},
	}
	for _, ids := range [][]int64{{3}, {9}, {0}, {-1}} {
		if _, err := SelectTaskLabels(available, ids); !errors.Is(err, ErrInvalidLabels) {
			t.Fatalf("ids %v: %v", ids, err)
		}
	}
	selected, err := SelectTaskLabels(available, []int64{4, 1, 4, 2})
	if err != nil || len(selected) != 3 || selected[0].ID != 4 {
		t.Fatalf("selected=%v err=%v", selected, err)
	}
	for _, title := range []string{"vbu:job", "vbu:future", " VBU:date-only ", "VBU:JOB"} {
		if !IsInternalLabel(title) {
			t.Fatalf("unprotected %q", title)
		}
	}
	for _, title := range []string{"work", "job", " JOB "} {
		if IsInternalLabel(title) {
			t.Fatalf("ordinary label rejected: %q", title)
		}
	}
}

func TestResolveOrdinaryJobLabel(t *testing.T) {
	t.Parallel()
	client := &createClientStub{}
	label, err := ResolveUserLabel(t.Context(), client, "job")
	if err != nil || label.Title != "job" {
		t.Fatalf("label=%v err=%v", label, err)
	}
}
