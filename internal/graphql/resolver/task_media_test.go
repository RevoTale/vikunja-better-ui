package resolver

import (
	"context"
	"strings"
	"testing"

	"github.com/99designs/gqlgen/graphql"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestMediaRequiresSessionCSRFAndValidFileBeforeUpstream(t *testing.T) {
	t.Parallel()
	root, sessions, session, cookie := taskActionResolver(t, &taskActionClientStub{})
	_, err := (&queryResolver{root}).TaskAttachments(t.Context(), "42", 1)
	assertErrorCode(t, err, "UNAUTHENTICATED")
	withTaskActionContext(t, sessions, session, cookie, func(ctx context.Context) {
		_, err := (&mutationResolver{root}).UploadTaskMedia(ctx, model.UploadTaskMediaInput{TaskID: "42"})
		assertErrorCode(t, err, "CSRF_INVALID")
		_, err = (&mutationResolver{root}).UploadTaskMedia(ctx, model.UploadTaskMediaInput{
			TaskID: "42", CsrfToken: sessions.CSRFToken(session), File: graphql.Upload{
				File:     strings.NewReader("<script/>"),
				Filename: "photo.png",
				Size:     9,
			},
		})
		assertErrorCode(t, err, "VALIDATION_FAILED")
		_, err = (&queryResolver{root}).TaskAttachments(ctx, "42", 0)
		assertErrorCode(t, err, "VALIDATION_FAILED")
	})
}

func TestAttachmentModelKeepsAudioClassificationForReuse(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		mime, filename, want string
	}{
		{"audio/x-m4a", "recording.m4a", "audio/mp4"},
		{"video/mp4", "recording.M4A", "audio/mp4"},
		{"video/webm", "recording.weba", "audio/webm"},
		{"video/webm", "video.webm", "video/webm"},
		{"image/png", "spoofed.weba", "image/png"},
		{"text/html", "spoofed.m4a", "text/html"},
	} {
		attachment := attachmentModel(vikunja.TaskAttachment{
			ID:     8,
			TaskID: 42,
			File:   vikunja.AttachmentFile{MIME: test.mime, Name: test.filename},
		})
		if attachment.MimeType != test.want {
			t.Fatalf("%s %s: type = %q, want %q", test.mime, test.filename, attachment.MimeType, test.want)
		}
	}
}
