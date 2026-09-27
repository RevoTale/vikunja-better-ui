package resolver

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func attachmentModel(attachment vikunja.TaskAttachment) *model.TaskAttachment {
	id := strconv.FormatInt(attachment.ID, 10)
	taskID := strconv.FormatInt(attachment.TaskID, 10)
	return &model.TaskAttachment{
		ID: id, TaskID: taskID, Name: attachment.File.Name,
		MimeType:  service.AttachmentMediaType(attachment.File.MIME, attachment.File.Name),
		SizeBytes: float64(attachment.File.Size), ContentURL: "/media/tasks/" + taskID + "/attachments/" + id,
		SourceURL: attachment.SourceURL,
	}
}

func (resolver *Resolver) mediaError(err error, uploading bool) error {
	if errors.Is(err, service.ErrInvalidMedia) {
		return clientError("VALIDATION_FAILED", service.ErrInvalidMedia.Error())
	}
	if upstream, ok := errors.AsType[*vikunja.Error](err); ok {
		switch upstream.Status {
		case http.StatusUnauthorized, http.StatusForbidden:
			return clientError("FORBIDDEN", "The Vikunja token does not permit this attachment action.")
		case http.StatusNotFound:
			return clientError("NOT_FOUND", "The task or attachment is not accessible.")
		case http.StatusRequestEntityTooLarge:
			return clientError("VALIDATION_FAILED", "The file exceeds the Vikunja instance upload limit.")
		}
	}
	resolver.logError("attachment request failed", err)
	if !uploading {
		return upstreamClientError(err, "Attachments could not be loaded. Try refreshing the list.")
	}
	return clientError("UPLOAD_UNCONFIRMED", "The attachment could not be confirmed. Check the task attachments before retrying; the file may already be uploaded.")
}
