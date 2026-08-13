package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestRepairMarkerAttachesAndProvesMarker(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 12, 12, 0, 0, 0, time.UTC)
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	token, err := capabilities.IssueMarkerRepair("session-1", MarkerRepairGrant{
		TaskID: 11, MarkerTitle: dateOnlyLabel, ETag: `"v1"`,
	})
	if err != nil {
		t.Fatal(err)
	}
	client := &repairClientStub{
		labels: []vikunja.Label{{ID: 3, Title: dateOnlyLabel}},
		reads: []taskRead{
			{task: vikunja.Task{ID: 11, Title: "Pay bill"}, etag: `"v1"`},
			{task: vikunja.Task{ID: 11, Title: "Pay bill", Labels: []vikunja.Label{{ID: 3, Title: dateOnlyLabel}}}, etag: `"v2"`},
		},
	}
	result, err := RepairMarker(context.Background(), client, capabilities, "session-1", token)
	if err != nil {
		t.Fatalf("RepairMarker() error = %v", err)
	}
	if !result.Complete || result.Capability != "" || !hasLabel(result.Task.Labels, dateOnlyLabel) {
		t.Fatalf("RepairMarker() = %#v", result)
	}
	if client.attachedTask != 11 || client.attachedLabel != 3 {
		t.Fatalf("attachment = %d/%d", client.attachedTask, client.attachedLabel)
	}
}

func TestRepairMarkerSkipsAlreadySatisfiedStep(t *testing.T) {
	t.Parallel()

	now := time.Now()
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	token, err := capabilities.IssueMarkerRepair("session-1", MarkerRepairGrant{
		TaskID: 11, MarkerTitle: jobLabel, ETag: `"v1"`,
	})
	if err != nil {
		t.Fatal(err)
	}
	client := &repairClientStub{reads: []taskRead{{
		task: vikunja.Task{ID: 11, Labels: []vikunja.Label{{ID: 4, Title: jobLabel}}}, etag: `"changed"`,
	}}}
	result, err := RepairMarker(context.Background(), client, capabilities, "session-1", token)
	if err != nil || !result.Complete || client.attachedTask != 0 {
		t.Fatalf("RepairMarker() = %#v, %v", result, err)
	}
}

func TestRepairMarkerRejectsConcurrentChange(t *testing.T) {
	t.Parallel()

	now := time.Now()
	capabilities := NewCapabilityManager([]byte("01234567890123456789012345678901"), func() time.Time { return now })
	token, err := capabilities.IssueMarkerRepair("session-1", MarkerRepairGrant{
		TaskID: 11, MarkerTitle: jobLabel, ETag: `"v1"`,
	})
	if err != nil {
		t.Fatal(err)
	}
	client := &repairClientStub{reads: []taskRead{{task: vikunja.Task{ID: 11}, etag: `"v2"`}}}
	_, err = RepairMarker(context.Background(), client, capabilities, "session-1", token)
	if !errors.Is(err, ErrTaskStateChanged) || client.attachedTask != 0 {
		t.Fatalf("RepairMarker() error = %v, attachment = %d", err, client.attachedTask)
	}
}

type repairClientStub struct {
	labels        []vikunja.Label
	reads         []taskRead
	readCalls     int
	attachedTask  int64
	attachedLabel int64
}

func (client *repairClientStub) Labels(context.Context) ([]vikunja.Label, error) {
	return client.labels, nil
}

func (client *repairClientStub) CreateLabel(_ context.Context, input vikunja.LabelWrite) (vikunja.Label, error) {
	label := vikunja.Label{ID: 8, Title: input.Title}
	client.labels = append(client.labels, label)
	return label, nil
}

func (client *repairClientStub) Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	read := client.reads[client.readCalls]
	client.readCalls++
	return read.task, vikunja.ResponseMetadata{ETag: read.etag}, nil
}

func (client *repairClientStub) AttachLabel(_ context.Context, taskID int64, labelID int64) error {
	client.attachedTask = taskID
	client.attachedLabel = labelID
	return nil
}
