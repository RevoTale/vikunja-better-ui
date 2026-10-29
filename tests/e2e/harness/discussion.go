package main

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func seedDiscussion(ctx context.Context, value string) error {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return errors.New("invalid fixture task ID")
	}
	upstream := os.Getenv("E2E_VIKUNJA_URL")
	if err = validateDiscussionFixture(os.Getenv("E2E_FIXTURE_DIR"), upstream,
		os.Getenv("CI_SYSTEM_NAME") == "woodpecker" && os.Getenv("E2E_VIKUNJA_SERVICE") == "1"); err != nil {
		return err
	}
	token := os.Getenv("E2E_VIKUNJA_API_TOKEN")
	if token == "" {
		return errors.New("missing fixture API token")
	}
	api := &fixtureAPI{baseURL: upstream, token: token}
	source, err := api.seedReplyChain(ctx, id)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(os.Stdout, source)
	return err
}

func validateDiscussionFixture(directory, origin string, service bool) error {
	root, err := filepath.EvalSymlinks(directory)
	if err != nil {
		return err
	}
	temporary, err := filepath.EvalSymlinks(os.TempDir())
	if err != nil {
		return err
	}
	if filepath.Dir(root) != temporary || !strings.HasPrefix(filepath.Base(root), "vikunja-better-ui-e2e.") ||
		!validDiscussionOrigin(origin, service) {
		return errors.New("refusing a non-isolated discussion fixture")
	}
	//nolint:gosec // Read only the ownership marker inside the validated private temporary fixture directory.
	owner, err := os.ReadFile(filepath.Join(root, ".discussion-fixture"))
	if err != nil {
		return err
	}
	if string(owner) != origin {
		return errors.New("invalid fixture ownership")
	}
	return nil
}

func (api *fixtureAPI) seedReplyChain(ctx context.Context, taskID int64) (int64, error) {
	const commentCount = 51
	var source, parent int64
	var previous time.Time
	for index := range commentCount {
		body := fmt.Sprintf("<p>Journal %d</p>", index)
		if index == 1 {
			body = fmt.Sprintf("<blockquote data-comment-id=%q>Journal 0</blockquote>%s", strconv.FormatInt(source, 10), body)
		}
		if index == commentCount-1 {
			body = fmt.Sprintf("<blockquote data-comment-id=%q>Journal 1</blockquote><p>Last reply</p>",
				strconv.FormatInt(parent, 10))
		}
		comment, err := api.create(ctx, "/tasks/"+strconv.FormatInt(taskID, 10)+"/comments",
			map[string]string{"comment": body})
		if err != nil {
			return 0, err
		}
		if comment.ID <= 0 || comment.Created.IsZero() || comment.Created.Before(previous) {
			return 0, errors.New("fixture comments must have ordered server timestamps")
		}
		// Vikunja persists comment timestamps at second precision. Separate the
		// two quote ancestors and the final page; filler ordering is irrelevant.
		if index == 0 || index == 1 || index == commentCount-2 {
			if err = nextCommentSecond(ctx, comment.Created); err != nil {
				return 0, err
			}
		}
		previous = comment.Created
		if index == 0 {
			source = comment.ID
		}
		if index == 1 {
			parent = comment.ID
		}
	}
	return source, nil
}

func validDiscussionOrigin(origin string, service bool) bool {
	address, err := url.Parse(origin)
	if err != nil {
		return false
	}
	hostname := "127.0.0.1"
	if service {
		hostname = "vikunja"
	}
	return address.Scheme == "http" && address.Hostname() == hostname && address.Port() != "" &&
		(!service || address.Port() == "3456") && address.User == nil && address.Path == "" &&
		address.RawQuery == "" && address.Fragment == ""
}

func nextCommentSecond(ctx context.Context, created time.Time) error {
	timer := time.NewTimer(time.Until(created.Truncate(time.Second).Add(time.Second)))
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
