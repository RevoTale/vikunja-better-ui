package web

import (
	"context"
	"crypto/rand"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type mediaClientStub struct {
	response  *http.Response
	err       error
	calls     int
	byteRange string
}

func (stub *mediaClientStub) AttachmentContent(
	_ context.Context,
	_, _ int64,
	byteRange string,
) (*http.Response, error) {
	stub.calls++
	stub.byteRange = byteRange
	return stub.response, stub.err
}

func mediaTestHandler(t *testing.T, client *mediaClientStub) (http.Handler, *http.Cookie) {
	t.Helper()
	sessions := auth.NewSessionManager([]byte("test-secret"), time.Now, rand.Reader)
	token, session, err := sessions.Issue()
	if err != nil {
		t.Fatal(err)
	}
	cookies := auth.NewSessionCookies(false)
	w := httptest.NewRecorder()
	cookies.Set(w, token, session.ExpiresAt)
	mux := http.NewServeMux()
	mux.Handle("GET /media/tasks/{task}/attachments/{attachment}", NewTaskMediaHandler(client, nil))
	return auth.HTTPContext(sessions, cookies)(mux), w.Result().Cookies()[0]
}

func TestTaskMediaRequiresSessionAndSafeIdentity(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		path, byteRange string
		authenticated   bool
		status          int
	}{
		{"/media/tasks/42/attachments/8", "", false, http.StatusUnauthorized},
		{"/media/tasks/0/attachments/8", "", true, http.StatusBadRequest},
		{"/media/tasks/42/attachments/evil", "", true, http.StatusBadRequest},
		{"/media/tasks/42/attachments/8?url=https://evil.test", "", true, http.StatusBadRequest},
		{"/media/tasks/42/attachments/8", "bytes=0-1,4-5", true, http.StatusBadRequest},
	} {
		stub := &mediaClientStub{}
		handler, cookie := mediaTestHandler(t, stub)
		r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, test.path, nil)
		if test.authenticated {
			r.AddCookie(cookie)
		}
		r.Header.Set("Range", test.byteRange)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != test.status || stub.calls != 0 {
			t.Fatalf("%s: status %d calls %d", test.path, w.Code, stub.calls)
		}
	}
}

func TestTaskMediaStreamsPrivateRangeWithoutUpstreamHeaders(t *testing.T) {
	t.Parallel()
	stub := &mediaClientStub{response: &http.Response{StatusCode: http.StatusPartialContent, Header: http.Header{
		"Content-Type": {"video/mp4"}, "Content-Range": {"bytes 2-5/10"},
		"Set-Cookie": {"upstream=secret"}, "Location": {"https://evil.test"},
	}, Body: io.NopCloser(strings.NewReader("2345"))}}
	handler, cookie := mediaTestHandler(t, stub)
	r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/media/tasks/42/attachments/8", nil)
	r.AddCookie(cookie)
	r.Header.Set("Range", "bytes=2-5")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusPartialContent || w.Body.String() != "2345" || stub.byteRange != "bytes=2-5" {
		t.Fatalf("stream = %d %s", w.Code, w.Body.String())
	}
	if w.Header().Get("Cache-Control") != "private, no-store" ||
		w.Header().Get("Content-Range") != "bytes 2-5/10" ||
		w.Header().Get("Set-Cookie") != "" ||
		w.Header().Get("Location") != "" {
		t.Fatalf("unsafe headers: %v", w.Header())
	}
}

func TestTaskMediaRejectsActiveContentAndUpstreamPermissions(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		mime   string
		err    error
		status int
	}{
		{"text/html", nil, http.StatusUnsupportedMediaType}, {"image/svg+xml", nil, http.StatusUnsupportedMediaType},
		{"image/png", &vikunja.Error{Status: http.StatusForbidden}, http.StatusForbidden},
	} {
		stub := &mediaClientStub{
			response: &http.Response{
				StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {test.mime}},
				Body: io.NopCloser(strings.NewReader("untrusted")),
			},
			err: test.err,
		}
		handler, cookie := mediaTestHandler(t, stub)
		r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/media/tasks/42/attachments/8", nil)
		r.AddCookie(cookie)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != test.status || strings.Contains(w.Body.String(), "untrusted") {
			t.Fatalf("status %d body %s", w.Code, w.Body.String())
		}
	}
}

func TestTaskMediaValidatesFullAudioAndSpoofedContent(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name, mime, data, wantType string
		status                     int
	}{
		{"flac", "audio/flac", "fLaC\x00\x00\x00\x22" + strings.Repeat("\x00", 34), "audio/flac", http.StatusOK},
		{"untagged mp3", "audio/mpeg", "\xff\xfb\x90\x00payload", "audio/mpeg", http.StatusOK},
		{"m4a alias", "audio/x-m4a", "\x00\x00\x00\x18ftypM4A \x00\x00\x00\x00M4A isom", "audio/mp4", http.StatusOK},
		{"audio webm", "audio/webm", "\x1a\x45\xdf\xa3payload", "audio/webm", http.StatusOK},
		{"spoofed html", "image/png", "<html>untrusted</html>", "", http.StatusUnsupportedMediaType},
		{"spoofed svg", "video/webm", "<svg onload='alert(1)'/>", "", http.StatusUnsupportedMediaType},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			body := &trackedMediaBody{reader: strings.NewReader(test.data)}
			stub := &mediaClientStub{response: &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": {test.mime}},
				Body:       body,
			}}
			handler, cookie := mediaTestHandler(t, stub)
			r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/media/tasks/42/attachments/8", nil)
			r.AddCookie(cookie)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != test.status || !body.closed {
				t.Fatalf("status %d, body closed %t", w.Code, body.closed)
			}
			if test.status == http.StatusOK &&
				(w.Header().Get("Content-Type") != test.wantType ||
					w.Body.String() != test.data) {
				t.Fatalf("type %s, body %q", w.Header().Get("Content-Type"), w.Body.String())
			}
		})
	}
}

func TestTaskMediaHeadAndUnsatisfiableRangeCloseBody(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name, method, byteRange string
		status                  int
	}{
		{"head", http.MethodHead, "", http.StatusOK},
		{"unsatisfiable range", http.MethodGet, "bytes=100-", http.StatusRequestedRangeNotSatisfiable},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			body := &trackedMediaBody{reader: strings.NewReader("\x89PNG\r\n\x1a\ncontent")}
			stub := &mediaClientStub{response: &http.Response{StatusCode: test.status, Header: http.Header{
				"Content-Type": {"image/png"}, "Content-Range": {"bytes */15"}, "Content-Length": {"15"},
			}, Body: body}}
			handler, cookie := mediaTestHandler(t, stub)
			r := httptest.NewRequestWithContext(t.Context(), test.method, "/media/tasks/42/attachments/8", nil)
			r.AddCookie(cookie)
			r.Header.Set("Range", test.byteRange)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != test.status || w.Body.Len() != 0 || !body.closed {
				t.Fatalf("status %d, body %q, closed %t", w.Code, w.Body.String(), body.closed)
			}
			if test.status == http.StatusRequestedRangeNotSatisfiable &&
				(body.bytes != 0 ||
					w.Header().Get("Content-Range") != "bytes */15") {
				t.Fatalf("range bytes %d, headers %v", body.bytes, w.Header())
			}
		})
	}
}

func TestTaskMediaClosesBodyAfterReadFailure(t *testing.T) {
	t.Parallel()
	for _, prefix := range []string{"", "\x89PNG\r\n\x1a\n" + strings.Repeat("\x00", 504)} {
		body := &trackedMediaBody{reader: io.MultiReader(strings.NewReader(prefix), failedMediaReader{})}
		stub := &mediaClientStub{response: &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": {"image/png"}},
			Body:       body,
		}}
		handler, cookie := mediaTestHandler(t, stub)
		r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/media/tasks/42/attachments/8", nil)
		r.AddCookie(cookie)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if !body.closed || (prefix == "" && w.Code != http.StatusBadGateway) {
			t.Fatalf("read failure: status %d, body closed %t", w.Code, body.closed)
		}
	}
}

type trackedMediaBody struct {
	reader io.Reader
	bytes  int
	closed bool
}

func (body *trackedMediaBody) Read(buffer []byte) (int, error) {
	n, err := body.reader.Read(buffer)
	body.bytes += n
	return n, err
}

func (body *trackedMediaBody) Close() error {
	body.closed = true
	return nil
}

type failedMediaReader struct{}

func (failedMediaReader) Read([]byte) (int, error) {
	return 0, errors.New("stream interrupted")
}
