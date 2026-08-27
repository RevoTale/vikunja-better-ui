package service

import (
	"context"
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestCreateTaskWithMarkerAttachesCanonicalLabel(t *testing.T) {
	t.Parallel()

	client := &createClientStub{
		labels:  []vikunja.Label{{ID: 3, Title: jobLabel}},
		created: vikunja.Task{ID: 11, ProjectID: 7, Title: "Deploy"},
	}
	result, err := CreateTaskWithMarker(context.Background(), client, 7, vikunja.TaskWrite{Title: "Deploy"}, jobLabel)
	if err != nil {
		t.Fatalf("CreateTaskWithMarker() error = %v", err)
	}
	if result.RepairRequired || result.Task.ID != 11 || len(result.Task.Labels) != 1 || result.Task.Labels[0].ID != 3 {
		t.Fatalf("CreateTaskWithMarker() = %#v", result)
	}
	if client.createTaskCalls != 1 || len(client.attachments) != 1 || client.attachments[0] != 3 {
		t.Fatalf("calls create=%d attachments=%v", client.createTaskCalls, client.attachments)
	}
}

func TestCreateTaskWithMarkerReturnsCreatedTaskForRepair(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("attach failed")
	client := &createClientStub{
		labels:           []vikunja.Label{{ID: 3, Title: dateOnlyLabel}},
		created:          vikunja.Task{ID: 11, ProjectID: 7, Title: "Pay bill"},
		attachErrByLabel: map[int64]error{3: wantErr},
	}
	result, err := CreateTaskWithMarker(context.Background(), client, 7, vikunja.TaskWrite{Title: "Pay bill"}, dateOnlyLabel)
	if err != nil {
		t.Fatalf("CreateTaskWithMarker() error = %v", err)
	}
	if !result.RepairRequired || !errors.Is(result.RepairCause, wantErr) ||
		len(result.MissingMarkers) != 1 || result.MissingMarkers[0] != dateOnlyLabel {
		t.Fatalf("CreateTaskWithMarker() = %#v", result)
	}
	if result.Task.ID != 11 || client.createTaskCalls != 1 {
		t.Fatalf("created task = %#v, calls = %d", result.Task, client.createTaskCalls)
	}
}

func TestCreateTaskWithoutMarkerMakesSingleWrite(t *testing.T) {
	t.Parallel()

	client := &createClientStub{created: vikunja.Task{ID: 12, ProjectID: 7, Title: "Read"}}
	result, err := CreateTaskWithMarker(context.Background(), client, 7, vikunja.TaskWrite{Title: "Read"}, "")
	if err != nil || result.Task.ID != 12 {
		t.Fatalf("CreateTaskWithMarker() = %#v, %v", result, err)
	}
	if client.createTaskCalls != 1 || len(client.attachments) != 0 {
		t.Fatalf("calls create=%d attachments=%v", client.createTaskCalls, client.attachments)
	}
}

func TestCreateTaskWithMarkersReturnsEveryUnconfirmedMarkerForRepair(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("fixed marker failed")
	client := &createClientStub{
		labels: []vikunja.Label{
			{ID: 3, Title: jobLabel},
			{ID: 4, Title: fixedDueTimeLabel},
		},
		created:          vikunja.Task{ID: 11, ProjectID: 7, Title: "Read a book"},
		attachErrByLabel: map[int64]error{4: wantErr},
	}
	result, err := CreateTaskWithMarkers(
		context.Background(), client, 7, vikunja.TaskWrite{Title: "Read a book"},
		[]string{jobLabel, fixedDueTimeLabel},
	)
	if err != nil {
		t.Fatalf("CreateTaskWithMarkers() error = %v", err)
	}
	if !result.RepairRequired || !errors.Is(result.RepairCause, wantErr) ||
		len(result.MissingMarkers) != 1 || result.MissingMarkers[0] != fixedDueTimeLabel {
		t.Fatalf("CreateTaskWithMarkers() = %#v", result)
	}
	if !hasLabel(result.Task.Labels, jobLabel) || hasLabel(result.Task.Labels, fixedDueTimeLabel) {
		t.Fatalf("created labels = %#v", result.Task.Labels)
	}
}

type createClientStub struct {
	labels           []vikunja.Label
	created          vikunja.Task
	attachErrByLabel map[int64]error
	createTaskCalls  int
	attachments      []int64
}

func (client *createClientStub) Labels(context.Context) ([]vikunja.Label, error) {
	return client.labels, nil
}

func (client *createClientStub) CreateLabel(_ context.Context, input vikunja.LabelWrite) (vikunja.Label, error) {
	label := vikunja.Label{ID: 20, Title: input.Title}
	client.labels = append(client.labels, label)
	return label, nil
}

func (client *createClientStub) CreateTask(_ context.Context, _ int64, _ vikunja.TaskWrite) (vikunja.Task, error) {
	client.createTaskCalls++
	return client.created, nil
}

func (client *createClientStub) Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	task := client.created
	for _, attachedID := range client.attachments {
		if client.attachErrByLabel[attachedID] != nil {
			continue
		}
		for _, label := range client.labels {
			if label.ID == attachedID && !hasLabelID(task.Labels, attachedID) {
				task.Labels = append(task.Labels, label)
			}
		}
	}
	return task, vikunja.ResponseMetadata{ETag: `"v1"`}, nil
}

func (client *createClientStub) AttachLabel(_ context.Context, taskID int64, labelID int64) error {
	if taskID != client.created.ID {
		return errors.New("unexpected task ID")
	}
	client.attachments = append(client.attachments, labelID)
	return client.attachErrByLabel[labelID]
}
