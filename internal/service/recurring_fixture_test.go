package service

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type recurringClientStub struct {
	completionClientStub

	searchPage     vikunja.TaskPage
	created        vikunja.Task
	createCalls    int
	createInput    vikunja.TaskWrite
	labels         []vikunja.Label
	attachedLabels map[int64]bool
}

func (client *recurringClientStub) TasksPage(_ context.Context, _ vikunja.TaskQuery) (vikunja.TaskPage, error) {
	return client.searchPage, nil
}

func (client *recurringClientStub) CreateTaskHTML(
	_ context.Context, _ int64, input vikunja.TaskWrite,
) (vikunja.Task, error) {
	client.createCalls++
	client.createInput = input
	return client.created, nil
}

func (client *recurringClientStub) Labels(context.Context) ([]vikunja.Label, error) {
	return client.labels, nil
}

func (client *recurringClientStub) CreateLabel(_ context.Context, input vikunja.LabelWrite) (vikunja.Label, error) {
	label := vikunja.Label{ID: 6, Title: input.Title}
	client.labels = append(client.labels, label)
	return label, nil
}

func (client *recurringClientStub) AttachLabel(_ context.Context, _ int64, labelID int64) error {
	if client.attachedLabels == nil {
		client.attachedLabels = make(map[int64]bool)
	}
	client.attachedLabels[labelID] = true
	return nil
}
