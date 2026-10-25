package web

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
)

const (
	publicRootCacheControl = "public, max-age=600, s-maxage=3600"
	repositoryURL          = "https://github.com/RevoTale/vikunja-better-ui"
	licenseURL             = repositoryURL + "/blob/main/LICENSE"
)

// PublicPageOptions configures anonymous HTML pages without changing private SPA routes.
type PublicPageOptions struct {
	PublicURL       *url.URL
	ActivityEnabled bool
	AllTimeEnabled  bool
	Activity        activitySnapshotReader
	AllTime         allTimeSnapshotReader
	PrivateFallback http.Handler
	Now             func() time.Time
}

type publicPages struct {
	index     []byte
	options   PublicPageOptions
	templates publicPageTemplates
}

// NewPublicPages serves the root landing page, enabled activity pages and crawler metadata.
func NewPublicPages(options PublicPageOptions) http.Handler {
	assets, err := fs.Sub(embeddedAssets, "assets/dist")
	if err != nil {
		panic("embedded frontend assets are unavailable")
	}
	indexHTML, err := fs.ReadFile(assets, "index.html")
	if err != nil {
		panic("embedded frontend index is unavailable")
	}
	return newPublicPages(indexHTML, options)
}

func newPublicPages(indexHTML []byte, options PublicPageOptions) http.Handler {
	if options.Now == nil {
		options.Now = time.Now
	}
	return &publicPages{index: indexHTML, options: options, templates: newPublicPageTemplates()}
}

func (pages *publicPages) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		writer.Header().Set("Allow", "GET, HEAD")
		writePublicPageError(writer, http.StatusMethodNotAllowed)
		return
	}
	if request.URL.RawQuery != "" {
		writePublicPageError(writer, http.StatusBadRequest)
		return
	}
	switch request.URL.Path {
	case "/":
		pages.serveRoot(writer, request)
	case "/activity":
		pages.serveActivity(writer, request)
	case "/all-time-activity":
		pages.serveAllTime(writer, request)
	case "/robots.txt":
		pages.serveRobots(writer, request)
	case "/sitemap.xml":
		pages.serveSitemap(writer, request)
	default:
		writePublicPageError(writer, http.StatusNotFound)
	}
}

func (pages *publicPages) serveRoot(writer http.ResponseWriter, request *http.Request) {
	metadata := rootPageMetadata(pages.options)
	body, jsonLD, err := renderPublicDocument(
		pages.index, metadata, rootPageContent(pages.templates.root, pages.options), nil,
	)
	if err != nil {
		writePublicPageError(writer, http.StatusInternalServerError)
		return
	}
	cacheControl := revalidatedCacheControl
	if pages.options.PublicURL != nil {
		cacheControl = publicRootCacheControl
	}
	writePublicHTML(writer, request, body, jsonLD, cacheControl, time.Time{})
}

func (pages *publicPages) serveActivity(writer http.ResponseWriter, request *http.Request) {
	if !pages.options.ActivityEnabled || pages.options.Activity == nil {
		pages.servePrivateFallback(writer, request)
		return
	}
	summary, err := pages.options.Activity.Read(request.Context())
	if err != nil {
		writePublicPageError(writer, http.StatusServiceUnavailable)
		return
	}
	response := newPublicActivityResponse(summary)
	body, jsonLD, err := renderPublicDocument(
		pages.index, activityPageMetadata(pages.options, response),
		activityPageContent(pages.templates.activity, response, pages.options.AllTimeEnabled), response,
	)
	if err != nil {
		writePublicPageError(writer, http.StatusInternalServerError)
		return
	}
	writePublicHTML(writer, request, body, jsonLD,
		publicSnapshotCacheControl(pages.options.Now(), summary.RefreshAt), summary.GeneratedAt)
}

func (pages *publicPages) serveAllTime(writer http.ResponseWriter, request *http.Request) {
	if !pages.options.AllTimeEnabled || pages.options.AllTime == nil {
		pages.servePrivateFallback(writer, request)
		return
	}
	summary, err := pages.options.AllTime.Read(request.Context())
	if err != nil {
		writePublicPageError(writer, http.StatusServiceUnavailable)
		return
	}
	response := newPublicAllTimeActivityResponse(summary)
	body, jsonLD, err := renderPublicDocument(
		pages.index, allTimePageMetadata(pages.options, response),
		allTimePageContent(pages.templates.allTime, response, pages.options.ActivityEnabled), response,
	)
	if err != nil {
		writePublicPageError(writer, http.StatusInternalServerError)
		return
	}
	writePublicHTML(writer, request, body, jsonLD,
		publicSnapshotCacheControl(pages.options.Now(), summary.RefreshAt), summary.GeneratedAt)
}

func (pages *publicPages) servePrivateFallback(writer http.ResponseWriter, request *http.Request) {
	_, authenticated := auth.SessionFromContext(request.Context())
	if authenticated && pages.options.PrivateFallback != nil {
		pages.options.PrivateFallback.ServeHTTP(writer, request)
		return
	}
	writePublicPageError(writer, http.StatusNotFound)
}

func writePublicHTML(
	writer http.ResponseWriter,
	request *http.Request,
	body []byte,
	jsonLD []byte,
	cacheControl string,
	lastModified time.Time,
) {
	hash := sha256.Sum256(body)
	etag := `"` + hex.EncodeToString(hash[:]) + `"`
	writer.Header().Set("Cache-Control", cacheControl)
	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	writer.Header().Set("ETag", etag)
	writer.Header().Set("Content-Security-Policy", publicPageCSP(jsonLD))
	if !lastModified.IsZero() {
		writer.Header().Set("Last-Modified", lastModified.UTC().Format(http.TimeFormat))
	}
	if request.Header.Get("If-None-Match") == etag {
		writer.WriteHeader(http.StatusNotModified)
		return
	}
	writer.WriteHeader(http.StatusOK)
	if request.Method == http.MethodHead {
		return
	}
	_, _ = io.Copy(writer, bytes.NewReader(body))
}

func publicPageCSP(jsonLD []byte) string {
	hash := sha256.Sum256(jsonLD)
	encoded := base64.StdEncoding.EncodeToString(hash[:])
	return "default-src 'self'; connect-src 'self'; img-src 'self' data:; " +
		"style-src 'self' 'unsafe-inline'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; " +
		"script-src 'self' 'sha256-" + encoded + "'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
}

func writePublicPageError(writer http.ResponseWriter, status int) {
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
	writer.Header().Set("X-Robots-Tag", "noindex")
	http.Error(writer, strings.ToLower(http.StatusText(status)), status)
}

func (pages *publicPages) serveRobots(writer http.ResponseWriter, request *http.Request) {
	body := "User-agent: *\nDisallow: /graphql\nDisallow: /media/\nDisallow: /integrations/\nDisallow: /public/\n"
	if pages.options.PublicURL != nil {
		body += "Sitemap: " + pages.options.PublicURL.String() + "/sitemap.xml\n"
	}
	writeCrawlerFile(writer, request, "text/plain; charset=utf-8", []byte(body))
}

func (pages *publicPages) serveSitemap(writer http.ResponseWriter, request *http.Request) {
	if pages.options.PublicURL == nil {
		writePublicPageError(writer, http.StatusNotFound)
		return
	}
	locations := []string{pages.options.PublicURL.String() + "/"}
	if pages.options.ActivityEnabled {
		locations = append(locations, pages.options.PublicURL.String()+"/activity")
	}
	if pages.options.AllTimeEnabled {
		locations = append(locations, pages.options.PublicURL.String()+"/all-time-activity")
	}
	var body strings.Builder
	body.WriteString(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	for _, location := range locations {
		_, _ = fmt.Fprintf(&body, "<url><loc>%s</loc></url>", location)
	}
	body.WriteString("</urlset>\n")
	writeCrawlerFile(writer, request, "application/xml; charset=utf-8", []byte(body.String()))
}

func writeCrawlerFile(writer http.ResponseWriter, request *http.Request, contentType string, body []byte) {
	writer.Header().Set("Cache-Control", metadataCacheControl)
	writer.Header().Set("Content-Type", contentType)
	writer.WriteHeader(http.StatusOK)
	if request.Method == http.MethodHead {
		return
	}
	_, _ = io.Copy(writer, bytes.NewReader(body))
}
