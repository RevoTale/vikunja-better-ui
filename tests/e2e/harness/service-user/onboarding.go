package main

import (
	"context"
	"errors"
	"net/http"
	"strconv"
)

// API signup creates an Inbox and saved filter; CLI user creation does not.
// Reset only the newly registered account to the same empty fixture baseline.
func resetOnboarding(ctx context.Context, baseURL, username, password string) error {
	var login struct {
		Token string `json:"token"`
	}
	if err := fixtureRequest(ctx, baseURL, http.MethodPost, "/login", "",
		map[string]string{"username": username, "password": password}, &login); err != nil {
		return err
	}
	if login.Token == "" {
		return errors.New("missing fixture login token")
	}
	var projects struct {
		Items []struct {
			ID    int64  `json:"id"`
			Title string `json:"title"`
		} `json:"items"`
	}
	if err := fixtureRequest(ctx, baseURL, http.MethodGet, "/projects", login.Token, nil, &projects); err != nil {
		return err
	}
	for _, project := range projects.Items {
		var path string
		switch {
		case project.ID > 0 && project.Title == "Inbox":
			path = "/projects/" + strconv.FormatInt(project.ID, 10)
		case project.ID < -1 && project.Title == "My Open Tasks":
			path = "/filters/" + strconv.FormatInt(-project.ID-1, 10)
		default:
			return errors.New("unexpected onboarding project in fresh fixture account")
		}
		if err := fixtureRequest(ctx, baseURL, http.MethodDelete, path, login.Token, nil, nil); err != nil {
			return err
		}
	}
	return nil
}
