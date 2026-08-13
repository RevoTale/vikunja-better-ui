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
	if client.createTaskCalls != 1 || client.attachedTask != 11 || client.attachedLabel != 3 {
		t.Fatalf("calls create=%d attach=%d/%d", client.createTaskCalls, client.attachedTask, client.attachedLabel)
	}
}

func TestCreateTaskWithMarkerReturnsCreatedTaskForRepair(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("attach failed")
	client := &createClientStub{
		labels:    []vikunja.Label{{ID: 3, Title: dateOnlyLabel}},
		created:   vikunja.Task{ID: 11, ProjectID: 7, Title: "Pay bill"},
		attachErr: wantErr,
	}
	result, err := CreateTaskWithMarker(context.Background(), client, 7, vikunja.TaskWrite{Title: "Pay bill"}, dateOnlyLabel)
	if err != nil {
		t.Fatalf("CreateTaskWithMarker() error = %v", err)
	}
	if !result.RepairRequired || !errors.Is(result.RepairCause, wantErr) || result.MissingMarker != dateOnlyLabel {
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
	if client.createTaskCalls != 1 || client.attachedTask != 0 {
		t.Fatalf("calls create=%d attach=%d", client.createTaskCalls, client.attachedTask)
	}
}

type createClientStub struct {
	labels          []vikunja.Label
	created         vikunja.Task
	attachErr       error
	createTaskCalls int
	attachedTask    int64
	attachedLabel   int64
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
	if client.attachedTask > 0 && client.attachErr == nil {
		for _, label := range client.labels {
			if label.ID == client.attachedLabel {
				task.Labels = append(task.Labels, label)
			}
		}
	}
	return task, vikunja.ResponseMetadata{ETag: `"v1"`}, nil
}

func (client *createClientStub) AttachLabel(_ context.Context, taskID int64, labelID int64) error {
	client.attachedTask = taskID
	client.attachedLabel = labelID
	return client.attachErr
}
