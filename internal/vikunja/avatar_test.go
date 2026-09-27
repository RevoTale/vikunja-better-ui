package vikunja

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestAvatarReturnsBoundedRasterData(t *testing.T) {
	t.Parallel()
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/prefix/api/v2/avatar/John O'Connor" || r.URL.Query().Get("size") != "64" || r.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("unexpected avatar request")
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(encoded.Bytes())
	}))
	defer server.Close()
	address, _ := url.Parse(server.URL + "/prefix")
	client := NewClient(address, "test-token")
	defer client.CloseIdleConnections()
	result, err := client.Avatar(t.Context(), "John O'Connor")
	if err != nil || result != "data:image/png;base64,"+base64.StdEncoding.EncodeToString(encoded.Bytes()) {
		t.Fatalf("avatar failed: %v", err)
	}
}

func TestAvatarRejectsUnsafeResponsesAndNames(t *testing.T) {
	t.Parallel()
	for _, body := range [][]byte{[]byte("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), []byte("<html>error</html>"), bytes.Repeat([]byte{0}, 128*1024+1)} {
		t.Run(string(body[:4]), func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(body) }))
			defer server.Close()
			address, _ := url.Parse(server.URL)
			client := NewClient(address, "test-token")
			defer client.CloseIdleConnections()
			if _, err := client.Avatar(t.Context(), "user"); err == nil {
				t.Fatal("unsafe avatar accepted")
			}
			for _, name := range []string{"", ".", "..", "../user", "a/b", "a\\b", "a?b", "a#b", "%2e%2e", strings.Repeat("a", 256)} {
				if _, err := client.Avatar(t.Context(), name); err == nil {
					t.Fatalf("unsafe name accepted: %q", name)
				}
			}
		})
	}
}

func TestAvatarRejectsOversizedDimensions(t *testing.T) {
	t.Parallel()
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, image.NewRGBA(image.Rect(0, 0, 513, 1))); err != nil {
		t.Fatal(err)
	}
	if _, err := avatarDataURL(encoded.Bytes()); err == nil {
		t.Fatal("oversized avatar accepted")
	}
}

func TestAvatarDoesNotFollowRedirects(t *testing.T) {
	t.Parallel()
	target := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Error("avatar redirect was followed")
	}))
	defer target.Close()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer server.Close()
	address, _ := url.Parse(server.URL)
	client := NewClient(address, "test-token")
	defer client.CloseIdleConnections()
	if _, err := client.Avatar(t.Context(), "user"); err == nil {
		t.Fatal("avatar redirect accepted")
	}
}
