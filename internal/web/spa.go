package web

import (
	"bytes"
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

const cspNoncePlaceholder = "__CSP_NONCE__"

const (
	hashedAssetCacheControl = "public, max-age=31536000, immutable"
	metadataCacheControl    = "public, max-age=600"
	revalidatedCacheControl = "private, no-cache"
)

//go:embed all:assets
var embeddedAssets embed.FS

func SPAHandler() http.Handler {
	assets, err := fs.Sub(embeddedAssets, "assets/dist")
	if err != nil {
		panic("embedded frontend assets are unavailable")
	}
	indexHTML, err := fs.ReadFile(assets, "index.html")
	if err != nil {
		panic("embedded frontend index is unavailable")
	}
	fileServer := http.FileServer(http.FS(assets))
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		requestedPath := strings.TrimPrefix(path.Clean("/"+request.URL.Path), "/")
		if requestedPath == "." || requestedPath == "" || requestedPath == "index.html" {
			serveIndex(writer, request, indexHTML)
			return
		}
		if file, openErr := assets.Open(requestedPath); openErr == nil {
			_ = file.Close()
			writer.Header().Set("Cache-Control", staticCacheControl(requestedPath))
			if requestedPath == "site.webmanifest" {
				writer.Header().Set("Content-Type", "application/manifest+json")
			}
			fileServer.ServeHTTP(writer, request)
			return
		}
		serveIndex(writer, request, indexHTML)
	})
}

func staticCacheControl(requestedPath string) string {
	switch {
	case strings.HasPrefix(requestedPath, "assets/"):
		return hashedAssetCacheControl
	case requestedPath == "favicon.svg", requestedPath == "site.webmanifest":
		return metadataCacheControl
	default:
		return revalidatedCacheControl
	}
}

func serveIndex(writer http.ResponseWriter, request *http.Request, indexHTML []byte) {
	body := bytes.Replace(indexHTML, []byte(cspNoncePlaceholder), []byte(cspNonce(request.Context())), 1)
	writer.Header().Set("Cache-Control", revalidatedCacheControl)
	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	writer.WriteHeader(http.StatusOK)
	if request.Method == http.MethodHead {
		return
	}
	_, _ = writer.Write(body)
}
