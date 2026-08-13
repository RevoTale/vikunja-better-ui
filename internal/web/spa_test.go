package web

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

var contentHashPattern = regexp.MustCompile(`-[A-Za-z0-9_-]{8,}\.[^.]+$`)

func TestEmbeddedAssetsHaveContentHashedNames(t *testing.T) {
	t.Parallel()

	err := fs.WalkDir(embeddedAssets, "assets/assets", func(assetPath string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if !entry.IsDir() && !contentHashPattern.MatchString(entry.Name()) {
			t.Errorf("asset %q has no content hash", assetPath)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk embedded assets: %v", err)
	}
}

func TestSPAHandlerServesIndexForSemanticRoute(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	SPAHandler().ServeHTTP(recorder, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://app.test/tasks/42", nil))
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `<div id="root"></div>`) {
		t.Fatalf("response = %d %q", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("Cache-Control = %q", recorder.Header().Get("Cache-Control"))
	}
}

func TestSPAHandlerServesNestedAsset(t *testing.T) {
	t.Parallel()
	matches, err := fs.Glob(embeddedAssets, "assets/assets/_*.js")
	if err != nil || len(matches) == 0 {
		t.Fatalf("embedded asset matches = %v, %v", matches, err)
	}
	requestPath := strings.TrimPrefix(matches[0], "assets/")

	recorder := httptest.NewRecorder()
	SPAHandler().ServeHTTP(
		recorder,
		httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://app.test/"+requestPath, nil),
	)
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Header().Get("Content-Type"), "javascript") {
		t.Fatalf("response = %d, Content-Type = %q, body = %.40q", recorder.Code, recorder.Header().Get("Content-Type"), recorder.Body.String())
	}
}

func TestSecurityHeaders(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	handler := SecurityHeaders(true)(SPAHandler())
	handler.ServeHTTP(recorder, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.test/", nil))
	if !strings.Contains(recorder.Header().Get("Content-Security-Policy"), "frame-ancestors 'none'") {
		t.Fatalf("CSP = %q", recorder.Header().Get("Content-Security-Policy"))
	}
	if recorder.Header().Get("Strict-Transport-Security") == "" || recorder.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("security headers = %#v", recorder.Header())
	}
}
