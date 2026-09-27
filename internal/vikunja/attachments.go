package vikunja

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type AttachmentFile struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	MIME string `json:"mime"`
	Size int64  `json:"size"`
}

type TaskAttachment struct {
	ID        int64          `json:"id"`
	TaskID    int64          `json:"task_id"`
	File      AttachmentFile `json:"file"`
	SourceURL string         `json:"-"`
}

type AttachmentPage struct {
	Items      []TaskAttachment `json:"items"`
	Page       int64            `json:"page"`
	PerPage    int64            `json:"per_page"`
	TotalPages int64            `json:"total_pages"`
}

var ErrAttachmentUploadUnconfirmed = errors.New("attachment upload could not be confirmed")

func attachmentPath(taskID int64) string {
	return "tasks/" + strconv.FormatInt(taskID, 10) + "/attachments"
}

func (client *Client) TaskAttachments(ctx context.Context, taskID, page int64) (AttachmentPage, error) {
	if taskID <= 0 || page <= 0 {
		return AttachmentPage{}, errors.New("task ID and page must be positive")
	}
	var result AttachmentPage
	query := url.Values{"page": {strconv.FormatInt(page, 10)}, "per_page": {"50"}}
	if _, err := client.doJSONWithQuery(ctx, http.MethodGet, attachmentPath(taskID), query, nil, "", &result); err != nil {
		return AttachmentPage{}, err
	}
	if result.Page != page || result.PerPage <= 0 || result.PerPage > 50 || result.TotalPages < 0 || int64(len(result.Items)) > result.PerPage {
		return AttachmentPage{}, ErrRejectedResponse
	}
	for index, item := range result.Items {
		if !validAttachment(item, taskID) {
			return AttachmentPage{}, ErrRejectedResponse
		}
		result.Items[index].SourceURL = client.attachmentSourceURL(taskID, item.ID)
	}
	return result, nil
}

func validAttachment(item TaskAttachment, taskID int64) bool {
	return item.ID > 0 && item.TaskID == taskID && item.File.ID > 0 && item.File.Size >= 0 && item.File.Name != ""
}

func (client *Client) UploadTaskAttachment(ctx context.Context, taskID int64, filename string, file io.Reader) (result TaskAttachment, requestErr error) {
	if taskID <= 0 || filename == "" || file == nil {
		return TaskAttachment{}, errors.New("task ID and file are required")
	}
	started := time.Now()
	defer func() {
		client.logRequest(ctx, http.MethodPost, attachmentPath(taskID), time.Since(started), requestErr)
	}()
	// Only the multipart framing is buffered. File bytes pass directly through.
	var framing bytes.Buffer
	writer := multipart.NewWriter(&framing)
	if _, err := writer.CreateFormFile("files", filename); err != nil {
		return TaskAttachment{}, err
	}
	header := bytes.Clone(framing.Bytes())
	framing.Reset()
	if err := writer.Close(); err != nil {
		return TaskAttachment{}, err
	}
	request, err := client.newJSONRequest(ctx, http.MethodPost, attachmentPath(taskID), nil, nil, "", "")
	if err != nil {
		return TaskAttachment{}, err
	}
	request.Body = io.NopCloser(io.MultiReader(bytes.NewReader(header), file, bytes.NewReader(framing.Bytes())))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response, err := client.httpClient.Do(request)
	if err != nil {
		return TaskAttachment{}, errors.Join(ErrAttachmentUploadUnconfirmed, err)
	}
	defer func() { _ = response.Body.Close() }()
	var uploaded struct {
		Success []TaskAttachment `json:"success"`
		Errors  []struct {
			Code int64 `json:"code"`
		} `json:"errors"`
	}
	if _, err := decodeJSONResponse(response, &uploaded); err != nil {
		return TaskAttachment{}, err
	}
	if len(uploaded.Errors) > 0 || len(uploaded.Success) != 1 || !validAttachment(uploaded.Success[0], taskID) {
		return TaskAttachment{}, ErrAttachmentUploadUnconfirmed
	}
	attachment := uploaded.Success[0]
	attachment.SourceURL = client.attachmentSourceURL(taskID, attachment.ID)
	return attachment, nil
}

func (client *Client) attachmentSourceURL(taskID, attachmentID int64) string {
	// Vikunja 2.5's native editor stores API v1 attachment URLs even though
	// this client's transport uses v2. Both address the same attachment.
	value := client.baseURL.JoinPath("api/v1", attachmentPath(taskID), strconv.FormatInt(attachmentID, 10))
	return value.String()
}

// AttachmentContent transfers ownership of the body to the caller on success.
// Redirects are disabled by the client, and no caller-supplied URL is accepted.
func (client *Client) AttachmentContent(ctx context.Context, taskID, attachmentID int64, byteRange string) (*http.Response, error) {
	if taskID <= 0 || attachmentID <= 0 {
		return nil, errors.New("task and attachment IDs must be positive")
	}
	path := attachmentPath(taskID) + "/" + strconv.FormatInt(attachmentID, 10)
	request, err := client.newJSONRequest(ctx, http.MethodGet, path, nil, nil, "", "")
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/octet-stream")
	if byteRange != "" {
		request.Header.Set("Range", byteRange)
	}
	response, err := client.httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	if response.StatusCode == http.StatusOK || response.StatusCode == http.StatusPartialContent || response.StatusCode == http.StatusRequestedRangeNotSatisfiable {
		return response, nil
	}
	_ = response.Body.Close()
	return nil, &Error{Status: response.StatusCode, Code: "UPSTREAM_REJECTED"}
}
