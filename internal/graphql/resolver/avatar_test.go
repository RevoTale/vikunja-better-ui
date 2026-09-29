package resolver

import (
	"context"
	"errors"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestDiscussionAvatarRequiresSession(t *testing.T) {
	t.Parallel()
	_, err := (&queryResolver{New(Dependencies{})}).DiscussionAvatar(t.Context(), "user")
	assertErrorCode(t, err, "UNAUTHENTICATED")
}

func TestDiscussionAvatarFallback(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name  string
		value string
		err   error
		code  string
	}{
		{name: "photo", value: "data:image/png;base64,photo"},
		{name: "unavailable", err: errors.New("upstream unavailable")},
		{name: "forbidden", err: &vikunja.Error{Status: 403}},
		{name: "invalid", err: vikunja.ErrInvalidAvatarUsername, code: "VALIDATION_FAILED"},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			root, sessions, session, cookie := taskActionResolver(t, &taskActionClientStub{})
			root.avatars = avatarStub{value: test.value, err: test.err}
			withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
				value, err := (&queryResolver{root}).DiscussionAvatar(ctx, "user")
				if test.code != "" {
					assertErrorCode(t, err, test.code)
					return
				}
				if err != nil || (test.value == "" && value != nil) ||
					(test.value != "" && (value == nil || *value != test.value)) {
					t.Fatalf("unexpected avatar result: %v, %v", value, err)
				}
			})
		})
	}
}

type avatarStub struct {
	value string
	err   error
}

func (stub avatarStub) Avatar(context.Context, string) (string, error) {
	return stub.value, stub.err
}
