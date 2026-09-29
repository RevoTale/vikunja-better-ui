package web

import (
	"bufio"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type attachmentReader interface {
	AttachmentContent(context.Context, int64, int64, string) (*http.Response, error)
}

var singleByteRange = regexp.MustCompile(`^bytes=(\d+-\d*|-\d+)$`)

// NewTaskMediaHandler streams validated attachments to authenticated app sessions.
func NewTaskMediaHandler(client attachmentReader, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		if _, ok := auth.SessionFromContext(r.Context()); !ok {
			http.Error(w, "Authentication required.", http.StatusUnauthorized)
			return
		}
		taskID, taskErr := strconv.ParseInt(r.PathValue("task"), 10, 64)
		attachmentID, fileErr := strconv.ParseInt(r.PathValue("attachment"), 10, 64)
		byteRange := r.Header.Get("Range")
		if taskErr != nil || fileErr != nil || taskID <= 0 ||
			attachmentID <= 0 ||
			r.URL.RawQuery != "" ||
			(byteRange != "" &&
				(len(byteRange) > 64 || !singleByteRange.MatchString(byteRange))) {
			http.Error(w, "Invalid media request.", http.StatusBadRequest)
			return
		}
		response, err := client.AttachmentContent(r.Context(), taskID, attachmentID, byteRange)
		if err != nil {
			mediaError(w, err)
			return
		}
		defer func() { _ = response.Body.Close() }()
		if err := streamMedia(w, r, response); err != nil && logger != nil {
			logger.WarnContext(r.Context(), "media stream interrupted", "task_id", taskID, "attachment_id", attachmentID)
		}
	})
}

func mediaError(w http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	if upstream, ok := errors.AsType[*vikunja.Error](err); ok {
		switch upstream.Status {
		case http.StatusForbidden, http.StatusUnauthorized:
			status = http.StatusForbidden
		case http.StatusNotFound:
			status = http.StatusNotFound
		}
	}
	http.Error(w, "Media is unavailable or access was denied.", status)
}

func streamMedia(w http.ResponseWriter, r *http.Request, response *http.Response) error {
	if response.StatusCode == http.StatusRequestedRangeNotSatisfiable {
		w.Header().Set("Content-Range", response.Header.Get("Content-Range"))
		w.WriteHeader(response.StatusCode)
		return nil
	}
	mediaType := service.AttachmentMediaType(response.Header.Get("Content-Type"), "")
	if !service.InlineMediaType(mediaType) {
		http.Error(w, "This media format cannot be displayed.", http.StatusUnsupportedMediaType)
		return nil
	}
	body := bufio.NewReader(response.Body)
	if response.StatusCode == http.StatusOK {
		const signatureBytes = 512
		head, err := body.Peek(signatureBytes)
		if err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "Media could not be read.", http.StatusBadGateway)
			return err
		}
		mediaType = service.MediaContentType(head, mediaType)
		if mediaType == "" {
			http.Error(w, "This media format cannot be displayed.", http.StatusUnsupportedMediaType)
			return nil
		}
	}
	w.Header().Set("Content-Type", mediaType)
	for _, header := range []string{"Content-Length", "Content-Range", "Accept-Ranges"} {
		if value := response.Header.Get(header); value != "" {
			w.Header().Set(header, value)
		}
	}
	w.WriteHeader(response.StatusCode)
	if r.Method == http.MethodHead {
		return nil
	}
	_, err := io.Copy(w, body)
	return err
}
