package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"
)

const (
	invalidFixtureTitle = "Invalid recurring history fixture"
	labeledFixtureTitle = "Labeled task fixture"
	secondsPerDay       = 86400
)

func seedFixtures(ctx context.Context, upstream, username, password string, demo bool) (map[string]string, error) {
	location, err := time.LoadLocation(fixtureTimezone)
	if err != nil {
		return nil, err
	}
	api := &fixtureAPI{
		baseURL: upstream, clock: time.Now().In(location).Truncate(time.Millisecond), labels: make(map[string]int64),
	}
	if err = api.login(ctx, username, password); err != nil {
		return nil, err
	}
	empty, long, err := api.prepareProjects(ctx)
	if err != nil {
		return nil, err
	}
	if err = api.prepareUser(ctx); err != nil {
		return nil, err
	}
	if err = api.prepareLabels(ctx); err != nil {
		return nil, err
	}
	if err = api.seedSchedule(ctx, demo); err != nil {
		return nil, err
	}
	if err = api.seedSpecialTasks(ctx, long); err != nil {
		return nil, err
	}
	token, err := api.scopedToken(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"token": token, "projectId": strconv.FormatInt(api.projectID, 10), "emptyProjectId": strconv.FormatInt(empty, 10),
		fixtureTimezoneField: fixtureTimezone, "invalidTitle": invalidFixtureTitle, "labeledTitle": labeledFixtureTitle,
	}, nil
}

func (api *fixtureAPI) login(ctx context.Context, username, password string) error {
	entity, err := api.create(ctx, "/login", map[string]any{
		"username": username, "password": password, "long_token": false,
	})
	if err != nil {
		return err
	}
	if entity.Token == "" {
		return errors.New("missing fixture login token")
	}
	api.token = entity.Token
	return nil
}

func (api *fixtureAPI) prepareProjects(ctx context.Context) (int64, int64, error) {
	titles := []string{"E2E Daily Tasks", "E2E Empty Project",
		"E2E Project With A Deliberately Long Dashboard Name That Wraps Across Several Lines"}
	ids := make([]int64, 0, len(titles))
	for _, title := range titles {
		project, err := api.create(ctx, "/projects", map[string]string{fixtureTitleField: title})
		if err != nil {
			return 0, 0, err
		}
		if project.ID <= 0 {
			return 0, 0, errors.New("missing fixture project ID")
		}
		ids = append(ids, project.ID)
	}
	api.projectID = ids[0]
	const longProjectIndex = 2
	return ids[1], ids[longProjectIndex], nil
}

func (api *fixtureAPI) prepareUser(ctx context.Context) error {
	settings := map[string]any{
		"default_project_id": api.projectID, "discoverable_by_email": false, "discoverable_by_name": false,
		"email_reminders_enabled": false, "frontend_settings": map[string]any{}, "language": "en", "name": "E2E User",
		"overdue_tasks_reminders_enabled": false, "overdue_tasks_reminders_time": "09:00",
		fixtureTimezoneField: fixtureTimezone, "week_start": 1,
	}
	if err := api.request(ctx, http.MethodPut, "/user/settings/general", settings, nil); err != nil {
		return err
	}
	var user fixtureEntity
	if err := api.request(ctx, http.MethodGet, "/user", nil, &user); err != nil {
		return err
	}
	if user.Settings.Timezone != fixtureTimezone {
		return errors.New("fixture user timezone was not saved")
	}
	return nil
}

func (api *fixtureAPI) prepareLabels(ctx context.Context) error {
	for _, title := range []string{"vbu:job", "focus", "vbu:recurrence-history", "vbu:fixed-due-time",
		"work", "sport", "reading", "practice"} {
		label, err := api.create(ctx, "/labels", map[string]string{fixtureTitleField: title})
		if err != nil {
			return err
		}
		api.labels[title] = label.ID
	}
	return nil
}

func (api *fixtureAPI) scopedToken(ctx context.Context) (string, error) {
	const (
		create  = "create"
		readAll = "read_all"
		readOne = "read_one"
		update  = "update"
		remove  = "delete"
	)
	var routes map[string]map[string]json.RawMessage
	if err := api.request(ctx, http.MethodGet, "/routes", nil, &routes); err != nil {
		return "", err
	}
	permissions := map[string][]string{
		"other": {"user", "avatar"}, "projects": {readAll},
		"tasks": {create, readAll, readOne, update, remove}, "labels": {create, readAll},
		"tasks_labels":      {create, readAll, remove},
		"tasks_comments":    {create, readAll, readOne, update, remove},
		"tasks_attachments": {create, readAll, readOne}, "tasks_relations": {create, remove},
	}
	for group, names := range permissions {
		for _, name := range names {
			if _, ok := routes[group][name]; !ok {
				return "", errors.New("missing required fixture token permission")
			}
		}
	}
	const tokenLifetime = 24 * time.Hour
	token, err := api.create(ctx, "/tokens", map[string]any{
		fixtureTitleField: "Vikunja Better UI E2E", "expires_at": api.clock.Add(tokenLifetime), "permissions": permissions,
	})
	if err != nil {
		return "", err
	}
	if token.Token == "" {
		return "", errors.New("missing fixture API token")
	}
	return token.Token, nil
}
