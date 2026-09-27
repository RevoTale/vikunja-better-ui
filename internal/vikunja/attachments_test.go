package vikunja

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAttachmentUploadUsesSingleMultipartFile(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/v2/tasks/42/attachments" || r.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("unexpected upload request %s %s", r.Method, r.URL.Path)
		}
		reader, err := r.MultipartReader()
		if err != nil {
			t.Error(err)
			return
		}
		part, err := reader.NextPart()
		if err != nil {
			t.Error(err)
			return
		}
		body, err := io.ReadAll(part)
		if err != nil || part.FormName() != "files" || part.FileName() != "clip.png" || string(body) != "image bytes" {
			t.Errorf("unexpected file: %q %v", body, err)
		}
		if _, err := reader.NextPart(); !errors.Is(err, io.EOF) {
			t.Errorf("extra part: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"success":[{"id":8,"task_id":42,"file":{"id":10,"name":"clip.png","mime":"image/png","size":11}}],"errors":[]}`))
	}))
	t.Cleanup(server.Close)
	file, err := testClient(t, server.URL, "test-token").UploadTaskAttachment(t.Context(), 42, "clip.png", strings.NewReader("image bytes"))
	if err != nil || file.ID != 8 || file.File.MIME != "image/png" {
		t.Fatalf("upload = %#v, %v", file, err)
	}
}

func TestAttachmentUploadDoesNotTreatPartialFailureAsSuccess(t *testing.T) {
	t.Parallel()
	for _, body := range []string{
		`{"success":[],"errors":[{"message":"secret upstream details"}]}`,
		`{"success":[{"id":8,"task_id":99,"file":{"id":10}}],"errors":[]}`,
		`{"success":[],"errors":[]}`,
	} {
		t.Run(body, func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = io.Copy(io.Discard, r.Body)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusCreated)
				_, _ = w.Write([]byte(body))
			}))
			t.Cleanup(server.Close)
			_, err := testClient(t, server.URL, "test-token").UploadTaskAttachment(t.Context(), 42, "file.png", strings.NewReader("file"))
			if err == nil || strings.Contains(err.Error(), "secret") {
				t.Fatalf("error = %v", err)
			}
		})
	}
}

func TestAttachmentContentPreservesRangeAndRejectsRedirect(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v2/tasks/42/attachments/8" || r.Header.Get("Range") != "bytes=2-5" {
			t.Errorf("unexpected content request %s %s", r.URL.Path, r.Header.Get("Range"))
		}
		w.Header().Set("Content-Type", "video/mp4")
		w.Header().Set("Content-Range", "bytes 2-5/10")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = w.Write([]byte("2345"))
	}))
	t.Cleanup(server.Close)
	client := testClient(t, server.URL, "test-token")
	response, err := client.AttachmentContent(t.Context(), 42, 8, "bytes=2-5")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil || string(body) != "2345" || response.StatusCode != http.StatusPartialContent {
		t.Fatalf("content = %q, %v", body, err)
	}

	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, server.URL, http.StatusFound)
	}))
	t.Cleanup(redirect.Close)
	redirectResponse, err := testClient(t, redirect.URL, "test-token").AttachmentContent(t.Context(), 42, 8, "")
	if err == nil {
		_ = redirectResponse.Body.Close()
		t.Fatal("accepted redirect")
	}
}
