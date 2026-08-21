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

//go:embed all:assets
var embeddedAssets embed.FS

func SPAHandler() http.Handler {
	assets, err := fs.Sub(embeddedAssets, "assets")
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
			if requestedPath != "index.html" {
				writer.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			fileServer.ServeHTTP(writer, request)
			return
		}
		serveIndex(writer, request, indexHTML)
	})
}

func serveIndex(writer http.ResponseWriter, request *http.Request, indexHTML []byte) {
	body := bytes.Replace(indexHTML, []byte(cspNoncePlaceholder), []byte(cspNonce(request.Context())), 1)
	writer.Header().Set("Cache-Control", "no-cache")
	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	writer.WriteHeader(http.StatusOK)
	if request.Method == http.MethodHead {
		return
	}
	_, _ = writer.Write(body)
}
