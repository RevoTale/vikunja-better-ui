package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

const (
	fixtureTitleField     = "title"
	fixtureTimezoneField  = "timezone"
	patchDonePath         = "/done"
	patchTestOperation    = "test"
	patchReplaceOperation = "replace"
	fixtureTimezone       = "Europe/Kyiv"
	fixtureResponseLimit  = 4 << 20
	fixtureRequestTimeout = 30 * time.Second
)

type fixtureAPI struct {
	baseURL   string
	token     string
	projectID int64
	labels    map[string]int64
	clock     time.Time
}

type fixtureEntity struct {
	Created  time.Time `json:"created"`
	ID       int64     `json:"id"`
	Token    string    `json:"token"`
	DoneAt   time.Time `json:"done_at"`
	Settings struct {
		Timezone string `json:"timezone"`
	} `json:"settings"`
}

//nolint:gosec // G704: fixture origins are harness-owned loopback or validated CI URLs; redirects are refused.
func (api *fixtureAPI) request(ctx context.Context, method, path string, input, output any) error {
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, method, api.baseURL+"/api/v2"+path, bytes.NewReader(body))
	if err != nil {
		return errors.New("invalid fixture URL")
	}
	request.Header.Set("Content-Type", "application/json")
	if method == http.MethodPatch {
		request.Header.Set("Content-Type", "application/json-patch+json")
	}
	if api.token != "" {
		request.Header.Set("Authorization", "Bearer "+api.token)
	}
	client := &http.Client{Timeout: fixtureRequestTimeout, CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	response, err := client.Do(request)
	if err != nil {
		return errors.New("fixture request failed")
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("fixture %s %s: HTTP %d", method, path, response.StatusCode)
	}
	if output == nil {
		_, err = io.Copy(io.Discard, io.LimitReader(response.Body, fixtureResponseLimit))
		return err
	}
	if err = json.NewDecoder(io.LimitReader(response.Body, fixtureResponseLimit)).Decode(output); err != nil {
		return errors.New("invalid fixture response")
	}
	return nil
}

func (api *fixtureAPI) create(ctx context.Context, path string, input any) (fixtureEntity, error) {
	var entity fixtureEntity
	err := api.request(ctx, http.MethodPost, path, input, &entity)
	return entity, err
}

func (api *fixtureAPI) createTask(ctx context.Context, task fixtureTask, labels []string) (fixtureEntity, error) {
	created, err := api.create(ctx, "/projects/"+strconv.FormatInt(api.projectID, 10)+"/tasks", task)
	if err != nil {
		return fixtureEntity{}, err
	}
	for _, label := range labels {
		id, ok := api.labels[label]
		if !ok {
			return fixtureEntity{}, fmt.Errorf("missing fixture label %s", label)
		}
		if err = api.request(ctx, http.MethodPost, "/tasks/"+strconv.FormatInt(created.ID, 10)+"/labels",
			map[string]int64{"label_id": id}, nil); err != nil {
			return fixtureEntity{}, err
		}
	}
	return created, nil
}

type fixturePatch struct {
	Op    string `json:"op"`
	Path  string `json:"path"`
	Value any    `json:"value"`
}

func (api *fixtureAPI) patch(ctx context.Context, id int64, patch []fixturePatch, output any) error {
	return api.request(ctx, http.MethodPatch, "/tasks/"+strconv.FormatInt(id, 10), patch, output)
}
