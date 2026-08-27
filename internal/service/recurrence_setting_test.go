package service

import (
	"context"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestSetFixedDueTimeEnablesEligibleSeries(t *testing.T) {
	t.Parallel()

	before := eligibleFixedDueTimeTask()
	after := before
	after.Labels = []vikunja.Label{{ID: 10, Title: fixedDueTimeLabel}}
	client := &recurrenceSettingClientStub{
		reads:  []taskRead{{task: before, etag: `"v1"`}, {task: after, etag: `"v2"`}},
		labels: []vikunja.Label{{ID: 10, Title: fixedDueTimeLabel}},
	}

	result, err := SetFixedDueTime(context.Background(), client, 9, true)
	if err != nil {
		t.Fatalf("SetFixedDueTime() error = %v", err)
	}
	if !ClassifyTask(result).FixedDueTime || client.attachedLabel != 10 || client.detachedLabels != nil {
		t.Fatalf("SetFixedDueTime() = %#v, client = %#v", result, client)
	}
}

func TestSetFixedDueTimeEnablesEligibleRecurringJob(t *testing.T) {
	t.Parallel()

	before := recurringJobAt(
		time.Date(2026, time.August, 16, 20, 0, 0, 0, time.UTC),
		2*recurrenceDaySeconds,
		2,
	)
	before.ID = 9
	after := before
	after.Labels = append(after.Labels, vikunja.Label{ID: 10, Title: fixedDueTimeLabel})
	client := &recurrenceSettingClientStub{
		reads:  []taskRead{{task: before, etag: `"v1"`}, {task: after, etag: `"v2"`}},
		labels: []vikunja.Label{{ID: 10, Title: fixedDueTimeLabel}},
	}

	result, err := SetFixedDueTime(context.Background(), client, before.ID, true)
	if err != nil {
		t.Fatalf("SetFixedDueTime() error = %v", err)
	}
	classification := ClassifyTask(result)
	if classification.Kind != TaskKindJob || !classification.Recurring ||
		!classification.FixedDueTime {
		t.Fatalf("SetFixedDueTime() classification = %#v", classification)
	}
}

func TestSetFixedDueTimeDisablesEveryExactMarker(t *testing.T) {
	t.Parallel()

	before := eligibleFixedDueTimeTask()
	before.Labels = []vikunja.Label{
		{ID: 10, Title: fixedDueTimeLabel},
		{ID: 12, Title: fixedDueTimeLabel},
		{ID: 13, Title: "vbu:fixed-due-time "},
	}
	after := eligibleFixedDueTimeTask()
	after.Labels = []vikunja.Label{{ID: 13, Title: "vbu:fixed-due-time "}}
	client := &recurrenceSettingClientStub{
		reads: []taskRead{{task: before, etag: `"v1"`}, {task: after, etag: `"v3"`}},
	}

	result, err := SetFixedDueTime(context.Background(), client, 9, false)
	if err != nil {
		t.Fatalf("SetFixedDueTime() error = %v", err)
	}
	if ClassifyTask(result).FixedDueTime || len(client.detachedLabels) != 2 ||
		client.detachedLabels[0] != 10 || client.detachedLabels[1] != 12 {
		t.Fatalf("SetFixedDueTime() = %#v, detached = %#v", result, client.detachedLabels)
	}
}

func TestSetFixedDueTimeRejectsIneligibleEnablementBeforeWrite(t *testing.T) {
	t.Parallel()

	task := eligibleFixedDueTimeTask()
	task.RepeatMode = 0
	client := &recurrenceSettingClientStub{reads: []taskRead{{task: task, etag: `"v1"`}}}

	if _, err := SetFixedDueTime(context.Background(), client, 9, true); err == nil {
		t.Fatal("SetFixedDueTime() error = nil")
	}
	if client.attachedLabel != 0 || len(client.detachedLabels) != 0 {
		t.Fatalf("marker writes = attach %d detach %#v", client.attachedLabel, client.detachedLabels)
	}
}

func eligibleFixedDueTimeTask() vikunja.Task {
	return vikunja.Task{
		ID: 9, ProjectID: 7, Title: "Read",
		DueDate:     time.Date(2026, time.August, 16, 20, 0, 0, 0, time.UTC),
		RepeatAfter: 2 * 86400, RepeatMode: 2,
	}
}

type recurrenceSettingClientStub struct {
	reads          []taskRead
	readCalls      int
	labels         []vikunja.Label
	attachedLabel  int64
	detachedLabels []int64
}

func (client *recurrenceSettingClientStub) Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error) {
	read := client.reads[client.readCalls]
	client.readCalls++
	return read.task, vikunja.ResponseMetadata{ETag: read.etag}, nil
}

func (client *recurrenceSettingClientStub) Labels(context.Context) ([]vikunja.Label, error) {
	return client.labels, nil
}

func (client *recurrenceSettingClientStub) CreateLabel(_ context.Context, input vikunja.LabelWrite) (vikunja.Label, error) {
	label := vikunja.Label{ID: 10, Title: input.Title}
	client.labels = append(client.labels, label)
	return label, nil
}

func (client *recurrenceSettingClientStub) AttachLabel(_ context.Context, _ int64, labelID int64) error {
	client.attachedLabel = labelID
	return nil
}

func (client *recurrenceSettingClientStub) DetachLabel(_ context.Context, _ int64, labelID int64) error {
	client.detachedLabels = append(client.detachedLabels, labelID)
	return nil
}
