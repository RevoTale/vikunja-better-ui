package web

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

const publicPageTestIndex = `<!doctype html><html lang="en"><head>
<title>__PAGE_TITLE__</title>
<meta name="description" content="__PAGE_DESCRIPTION__" />
<meta name="robots" content="__ROBOTS__" />
<meta property="og:title" content="__PAGE_TITLE__" />
<meta property="og:description" content="__PAGE_DESCRIPTION__" />
<meta name="twitter:card" content="__TWITTER_CARD__" />
<meta name="twitter:title" content="__PAGE_TITLE__" />
<meta name="twitter:description" content="__PAGE_DESCRIPTION__" />
<!--PUBLIC_META--></head><body><div id="root"><!--PUBLIC_CONTENT--></div><!--PUBLIC_DATA--></body></html>`

func TestPublicRootRendersIndexableProductMetadataAndSourceLink(t *testing.T) {
	t.Parallel()
	publicURL := mustPublicURL(t)
	handler := newPublicPages([]byte(publicPageTestIndex), PublicPageOptions{
		PublicURL: publicURL, ActivityEnabled: true, AllTimeEnabled: false, Now: time.Now,
	})
	recorder := servePublicRequest(t, handler, http.MethodGet, "/", "session=value", "")
	body := recorder.Body.String()
	for _, want := range []string{
		`<title>Better Vikunja instance — Fast recurring task workflows</title>`,
		`<meta name="robots" content="index, follow"`,
		`<link rel="canonical" href="https://tasks.example.test/"`,
		`This is a deployed instance of the open-source Better Vikunja client, shaped around clear schedules`,
		`"@id":"https://tasks.example.test/#website"`,
		`"@id":"https://tasks.example.test/#application"`,
		`"@type":"WebApplication"`,
		`"@type":"SoftwareSourceCode"`,
		`"isBasedOn":{"@id":"https://github.com/RevoTale/vikunja-better-ui#software"}`,
		`"codeRepository":"https://github.com/RevoTale/vikunja-better-ui"`,
		`"targetProduct":{"@id":"https://github.com/RevoTale/vikunja-better-ui#software"}`,
		`href="/activity"`,
		`id="public-page-config"`,
		`Open-source software`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("root missing %q: %s", want, body)
		}
	}
	if strings.Contains(body, `"@id":"https://github.com/RevoTale/vikunja-better-ui#application"`) {
		t.Fatalf("root conflates the deployed application with the shared software product: %s", body)
	}
	if strings.Contains(body, `href="/all-time-activity"`) || strings.Contains(body, cspNoncePlaceholder) {
		t.Fatalf("root exposed disabled route or nonce placeholder: %s", body)
	}
	if recorder.Header().Get("ETag") == "" || !strings.HasPrefix(recorder.Header().Get("Cache-Control"), "public,") {
		t.Fatalf("root cache headers = %#v", recorder.Header())
	}
}

func TestPublicRootWithoutCanonicalOriginRemainsNoindex(t *testing.T) {
	t.Parallel()
	handler := newPublicPages([]byte(publicPageTestIndex), PublicPageOptions{Now: time.Now})
	recorder := servePublicRequest(t, handler, http.MethodGet, "/", "", "")
	if !strings.Contains(recorder.Body.String(), `name="robots" content="noindex, nofollow"`) ||
		strings.Contains(recorder.Body.String(), `rel="canonical"`) ||
		recorder.Header().Get("Cache-Control") != revalidatedCacheControl {
		t.Fatalf("private root = %#v %s", recorder.Header(), recorder.Body.String())
	}
}

func TestPublicActivityHTMLEmbedsBoundedSnapshotAndDatasetMetadata(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	summary := service.ActivitySummary{
		Total: 7, Timezone: "Europe/Kyiv", GeneratedAt: now, RefreshAt: now.Add(time.Hour),
	}
	summary.Days[13] = service.ActivityDay{Date: "2026-10-25", Count: 7, WithDeadlineCount: 6, OnTimeCount: 5}
	handler := newPublicPages([]byte(publicPageTestIndex), PublicPageOptions{
		PublicURL: mustPublicURL(t), ActivityEnabled: true,
		Activity: activitySnapshotStub{value: summary}, Now: func() time.Time { return now },
	})
	recorder := servePublicRequest(t, handler, http.MethodGet, "/activity", "private=value", "")
	body := recorder.Body.String()
	for _, want := range []string{
		`<title>14-day activity — Better Vikunja instance</title>`,
		`"@type":"Dataset"`,
		`"contentUrl":"https://tasks.example.test/public/v1/activity"`,
		`7 tasks completed`,
		`2026-10-25`,
		`id="public-activity-bootstrap"`,
		`"total":7`,
		`"dateModified":"2026-10-25T12:00:00Z"`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("activity HTML missing %q: %s", want, body)
		}
	}
	if recorder.Header().Get("Cache-Control") != "public, max-age=300, s-maxage=3600, stale-while-revalidate=60" ||
		recorder.Header().Get("Content-Security-Policy") == "" {
		t.Fatalf("activity headers = %#v", recorder.Header())
	}
}

func TestPublicActivityPagesAreNotAvailableWhenDisabled(t *testing.T) {
	t.Parallel()
	handler := newPublicPages([]byte(publicPageTestIndex), PublicPageOptions{Now: time.Now})
	for _, path := range []string{"/activity", "/all-time-activity"} {
		recorder := servePublicRequest(t, handler, http.MethodGet, path, "", "")
		if recorder.Code != http.StatusNotFound || recorder.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("%s response = %d %#v", path, recorder.Code, recorder.Header())
		}
	}
}

func TestDisabledPublicActivityFallsBackToPrivateShellForAuthenticatedSession(t *testing.T) {
	t.Parallel()
	now := func() time.Time { return time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC) }
	sessions := auth.NewSessionManager(
		[]byte("01234567890123456789012345678901"), now, bytes.NewReader([]byte("0123456789abcdef")),
	)
	token, session, err := sessions.Issue()
	if err != nil {
		t.Fatal(err)
	}
	cookies := auth.NewSessionCookies(false)
	pages := newPublicPages([]byte(publicPageTestIndex), PublicPageOptions{
		PrivateFallback: http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
			writer.Header().Set("Cache-Control", revalidatedCacheControl)
			_, _ = writer.Write([]byte("private app shell"))
		}),
		Now: now,
	})
	handler := auth.HTTPContext(sessions, cookies)(pages)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/activity", nil)
	cookieResponse := httptest.NewRecorder()
	cookies.Set(cookieResponse, token, session.ExpiresAt)
	request.AddCookie(cookieResponse.Result().Cookies()[0])
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Body.String() != "private app shell" ||
		recorder.Header().Get("Cache-Control") != revalidatedCacheControl {
		t.Fatalf("authenticated fallback = %d %#v %q", recorder.Code, recorder.Header(), recorder.Body.String())
	}
}

func TestRobotsAndSitemapUseOnlyConfiguredPublicRoutes(t *testing.T) {
	t.Parallel()
	handler := newPublicPages([]byte(publicPageTestIndex), PublicPageOptions{
		PublicURL: mustPublicURL(t), ActivityEnabled: true,
		AllTimeEnabled: false, Now: time.Now,
	})
	robots := servePublicRequest(t, handler, http.MethodGet, "/robots.txt", "", "")
	if !strings.Contains(robots.Body.String(), "Sitemap: https://tasks.example.test/sitemap.xml") ||
		!strings.Contains(robots.Body.String(), "Disallow: /graphql") {
		t.Fatalf("robots = %q", robots.Body.String())
	}
	sitemap := servePublicRequest(t, handler, http.MethodGet, "/sitemap.xml", "", "")
	if !strings.Contains(sitemap.Body.String(), "https://tasks.example.test/activity") ||
		strings.Contains(sitemap.Body.String(), "all-time-activity") {
		t.Fatalf("sitemap = %q", sitemap.Body.String())
	}
}

func TestPublicPageConditionalRequestReturnsNotModified(t *testing.T) {
	t.Parallel()
	handler := newPublicPages([]byte(publicPageTestIndex), PublicPageOptions{
		PublicURL: mustPublicURL(t), Now: time.Now,
	})
	first := servePublicRequest(t, handler, http.MethodGet, "/", "", "")
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	request.Header.Set("If-None-Match", first.Header().Get("ETag"))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotModified || recorder.Body.Len() != 0 {
		t.Fatalf("conditional root = %d %q", recorder.Code, recorder.Body.String())
	}
}

func mustPublicURL(t *testing.T) *url.URL {
	t.Helper()
	parsed, err := url.Parse("https://tasks.example.test")
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}
