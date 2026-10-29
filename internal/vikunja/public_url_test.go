package vikunja

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestAttachmentsSeparatePublicReferencesFromTransport(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Error("missing upstream authentication")
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.Method + " " + r.URL.Path {
		case "GET /internal/api/v2/tasks/42/attachments":
			_, _ = w.Write([]byte(`{"items":[{"id":8,"task_id":42,"file":{"id":10,"name":"a.png"}}],
				"page":1,"per_page":50,"total_pages":1}`))
		case "POST /internal/api/v2/tasks/42/attachments":
			_, _ = io.Copy(io.Discard, r.Body)
			_, _ = w.Write([]byte(`{"success":[{"id":8,"task_id":42,"file":{"id":10,"name":"a.png"}}]}`))
		case "GET /internal/api/v2/tasks/42/attachments/8":
			_, _ = w.Write([]byte("image bytes"))
		default:
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	publicURL := &url.URL{Scheme: "https", Host: "public.example", Path: "/public"}
	client := testClient(t, server.URL+"/internal", "test-token")
	WithPublicURL(publicURL)(client)
	publicURL.Host = "changed.example"
	page, err := client.TaskAttachments(t.Context(), 42, 1)
	if err != nil || len(page.Items) != 1 {
		t.Fatalf("attachments = %#v, %v", page, err)
	}
	want := "https://public.example/public/api/v1/tasks/42/attachments/8"
	if page.Items[0].SourceURL != want {
		t.Fatalf("source = %s", page.Items[0].SourceURL)
	}
	upload, err := client.UploadTaskAttachment(t.Context(), 42, "a.png", strings.NewReader("image bytes"))
	if err != nil || upload.SourceURL != want {
		t.Fatalf("upload = %#v, %v", upload, err)
	}
	response, err := client.AttachmentContent(t.Context(), 42, 8, "")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = response.Body.Close() }()
	body, err := io.ReadAll(response.Body)
	if err != nil || string(body) != "image bytes" {
		t.Fatalf("content = %q, %v", body, err)
	}
}

func TestAttachmentReferenceDefaultsToTransportURL(t *testing.T) {
	t.Parallel()
	client := testClient(t, "https://vikunja.example/sub", "test-token")
	if got := client.attachmentSourceURL(42, 8); got != "https://vikunja.example/sub/api/v1/tasks/42/attachments/8" {
		t.Fatalf("source = %s", got)
	}
}
