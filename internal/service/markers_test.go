package service

import (
	"context"
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestResolveMarkerChoosesLowestExactLabelID(t *testing.T) {
	t.Parallel()

	client := &markerClientStub{labelPages: [][]vikunja.Label{{
		{ID: 9, Title: jobLabel}, {ID: 3, Title: jobLabel}, {ID: 1, Title: "Job"},
	}}}
	label, err := ResolveMarker(context.Background(), client, jobLabel)
	if err != nil {
		t.Fatalf("ResolveMarker() error = %v", err)
	}
	if label.ID != 3 || client.createCalls != 0 {
		t.Fatalf("ResolveMarker() = %#v, creates = %d", label, client.createCalls)
	}
}

func TestResolveMarkerCreatesThenReconcilesCanonicalLabel(t *testing.T) {
	t.Parallel()

	client := &markerClientStub{
		labelPages: [][]vikunja.Label{
			{},
			{{ID: 8, Title: dateOnlyLabel}, {ID: 7, Title: dateOnlyLabel}},
		},
		created: vikunja.Label{ID: 8, Title: dateOnlyLabel},
	}
	label, err := ResolveMarker(context.Background(), client, dateOnlyLabel)
	if err != nil {
		t.Fatalf("ResolveMarker() error = %v", err)
	}
	if label.ID != 7 || client.createCalls != 1 {
		t.Fatalf("ResolveMarker() = %#v, creates = %d", label, client.createCalls)
	}
}

func TestResolveMarkerDoesNotHideCreateFailure(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("upstream unavailable")
	client := &markerClientStub{labelPages: [][]vikunja.Label{{}}, createErr: wantErr}
	_, err := ResolveMarker(context.Background(), client, recurrenceHistoryLabel)
	if !errors.Is(err, wantErr) {
		t.Fatalf("ResolveMarker() error = %v, want %v", err, wantErr)
	}
}

type markerClientStub struct {
	labelPages  [][]vikunja.Label
	listCalls   int
	createCalls int
	created     vikunja.Label
	createErr   error
}

func (client *markerClientStub) Labels(context.Context) ([]vikunja.Label, error) {
	index := client.listCalls
	client.listCalls++
	if index >= len(client.labelPages) {
		index = len(client.labelPages) - 1
	}
	return client.labelPages[index], nil
}

func (client *markerClientStub) CreateLabel(_ context.Context, _ vikunja.LabelWrite) (vikunja.Label, error) {
	client.createCalls++
	return client.created, client.createErr
}
