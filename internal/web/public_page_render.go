package web

import (
	"bytes"
	"encoding/json"
	"html"
	"html/template"
	"strings"
)

const (
	defaultPageTitle   = "Better Vikunja instance — Fast recurring task workflows"
	pageDescription    = "A deployed instance of the open-source Better Vikunja client for predictable Vikunja workflows."
	productDescription = "An open-source alternative client for fast, predictable Vikunja workflows."
)

type publicPageMetadata struct {
	Title       string
	Description string
	Robots      string
	Canonical   string
	Image       string
	BootstrapID string
	JSONLD      any

	ActivityEnabled bool
	AllTimeEnabled  bool
}

type publicPageTemplates struct {
	root     *template.Template
	activity *template.Template
	allTime  *template.Template
}

const rootContentHTML = `
<main class="min-h-svh overflow-hidden">
  <div class="mx-auto flex min-h-svh max-w-6xl flex-col px-5 sm:px-8">
    <header class="flex min-h-20 items-center justify-between gap-4 border-b">
      <a href="/" aria-label="Better Vikunja home" class="inline-flex items-center gap-3 font-semibold">
        <img src="/favicon.svg" alt="" aria-hidden="true" class="size-9" />
        <span>Better Vikunja</span>
      </a>
      <p class="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden="true" class="size-1.5 rounded-full bg-foreground/60"></span>
        Deployed instance
      </p>
    </header>
    <div class="grid flex-1 items-center gap-14 py-14 md:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)] md:py-20">
      <section class="max-w-2xl" aria-labelledby="landing-title">
        <p class="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Self-hosted task workspace
        </p>
        <h1 id="landing-title"
            class="font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
          A quieter way to keep recurring work moving.
        </h1>
        <p class="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
          This is a deployed instance of the open-source Better Vikunja client, shaped around clear schedules
          and predictable routines.
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-3">
          <a href="/login?returnTo=%2Ftoday"
             class="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 font-medium
                    text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2
                    focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            Sign in to your workspace <span aria-hidden="true">→</span>
          </a>
          {{if .Activity}}<a href="/activity"
             class="inline-flex min-h-11 items-center rounded-md border px-5 font-medium outline-none
                    hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                    focus-visible:ring-offset-background">View public activity</a>
          {{else}}{{if .AllTime}}<a href="/all-time-activity"
             class="inline-flex min-h-11 items-center rounded-md border px-5 font-medium outline-none
                    hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                    focus-visible:ring-offset-background">View public activity</a>{{end}}{{end}}
        </div>
        <p class="mt-5 text-sm text-muted-foreground">Your data stays in Vikunja.</p>
      </section>
      <aside aria-labelledby="purpose-title" class="border-t pt-7 md:border-t-0 md:border-l md:pl-8 md:pt-0">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Purpose-built</p>
        <h2 id="purpose-title" class="mt-3 font-serif text-2xl font-semibold leading-snug">
          Less setup between intention and action.
        </h2>
        <dl class="mt-6 divide-y border-y">
          <div class="py-4">
            <dt class="font-medium">Recurring work</dt>
            <dd class="mt-1 text-sm leading-6 text-muted-foreground">
              Repeat routines without rebuilding every occurrence.
            </dd>
          </div>
          <div class="py-4">
            <dt class="font-medium">Time-aware planning</dt>
            <dd class="mt-1 text-sm leading-6 text-muted-foreground">
              Plan the week around start, finish and due time.
            </dd>
          </div>
          <div class="py-4">
            <dt class="font-medium">One source of truth</dt>
            <dd class="mt-1 text-sm leading-6 text-muted-foreground">
              Keep Vikunja as the system of record.
            </dd>
          </div>
        </dl>
      </aside>
    </div>
    {{if or .Activity .AllTime}}<section aria-labelledby="public-activity-title"
      class="flex flex-col gap-4 border-t py-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 id="public-activity-title" class="font-medium">Public activity</h2>
        <p class="mt-1 text-sm text-muted-foreground">Anonymous aggregate progress from this instance.</p>
      </div>
      <nav aria-label="Public activity" class="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
        {{if .Activity}}<a href="/activity"
          class="underline decoration-border underline-offset-4 hover:decoration-foreground">Last 14 days</a>{{end}}
        {{if .AllTime}}<a href="/all-time-activity"
          class="underline decoration-border underline-offset-4 hover:decoration-foreground">
          All-time activity
        </a>{{end}}
      </nav>
    </section>{{end}}
    {{template "source-footer"}}
  </div>
</main>`

const activityContentHTML = `
<main class="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
  <header class="space-y-2">
    <h1 class="font-serif text-2xl font-semibold">Activity</h1>
    <p class="text-sm text-muted-foreground">Better Vikunja · Last 14 days</p>
  </header>
  <nav aria-label="Activity navigation" class="flex flex-wrap gap-4 text-sm">
    <a href="/" class="underline underline-offset-4">About Better Vikunja</a>
    {{if .ShowAllTime}}<a href="/all-time-activity" class="underline underline-offset-4">All-time activity</a>{{end}}
  </nav>
  <section class="space-y-3" aria-labelledby="activity-summary-title">
    <h2 id="activity-summary-title" class="font-semibold">{{.Total}} tasks completed</h2>
    <p>{{(index .Days 0).Date}} – {{(index .Days 13).Date}} · {{.Timezone}}</p>
    <ol aria-label="Daily completions" class="space-y-1">
      {{range .Days}}<li><time datetime="{{.Date}}">{{.Date}}</time>: {{.Count}}</li>{{end}}
    </ol>
  </section>
  {{template "source-footer"}}
</main>`

const allTimeContentHTML = `
<main class="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
  <header class="space-y-2">
    <h1 class="font-serif text-2xl font-semibold">All-time activity</h1>
    <p class="text-sm text-muted-foreground">Better Vikunja · Weekly history</p>
  </header>
  <nav aria-label="Activity navigation" class="flex flex-wrap gap-4 text-sm">
    <a href="/" class="underline underline-offset-4">About Better Vikunja</a>
    {{if .ShowActivity}}<a href="/activity" class="underline underline-offset-4">Last 14 days</a>{{end}}
  </nav>
  <section class="space-y-3" aria-labelledby="all-time-summary-title">
    <h2 id="all-time-summary-title" class="font-semibold">{{.Total}} tasks completed · All time</h2>
    <p>Latest {{len .Weeks}} Monday-start weeks · {{.Timezone}}</p>
    <ol aria-label="Weekly completions" class="space-y-1">
      {{range .Weeks}}<li>Week of <time datetime="{{.Date}}">{{.Date}}</time>: {{.Count}}</li>{{end}}
    </ol>
  </section>
  {{template "source-footer"}}
</main>`

const sourceFooterTemplate = `{{define "source-footer"}}
<footer class="flex flex-wrap items-center justify-between gap-3 border-t py-5 text-sm text-muted-foreground">
  <span>Independent, self-hosted deployment</span>
  <a href="https://github.com/RevoTale/vikunja-better-ui"
     class="inline-flex items-center gap-2 underline underline-offset-4">
    <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4" fill="none"
         stroke="currentColor" stroke-width="2">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.4 4
               5 5 0 0 0 19.3.5S18.2.1 15 1.8a13.4 13.4 0 0 0-7 0C4.8.1 3.7.5 3.7.5A5 5 0 0 0
               3.6 4a5.4 5.4 0 0 0-1.4 3.7c0 5.3 3.5 6.5 6.8 7-.7.6-1 1.3-1 2.2V22"/>
      <path d="M9 18c-4.5 2-5-2-7-2"/>
    </svg>
    <span>Open-source software · View source on GitHub</span>
  </a>
</footer>{{end}}`

func newPublicPageTemplates() publicPageTemplates {
	return publicPageTemplates{
		root: template.Must(template.New("root-public-content").Parse(rootContentHTML + sourceFooterTemplate)),
		activity: template.Must(
			template.New("activity-public-content").Parse(activityContentHTML + sourceFooterTemplate),
		),
		allTime: template.Must(
			template.New("all-time-public-content").Parse(allTimeContentHTML + sourceFooterTemplate),
		),
	}
}

func renderPublicDocument(
	indexHTML []byte,
	metadata publicPageMetadata,
	content []byte,
	bootstrap any,
) ([]byte, []byte, error) {
	jsonLD, err := json.Marshal(metadata.JSONLD)
	if err != nil {
		return nil, nil, err
	}
	extraHead := publicMetadataHTML(metadata, jsonLD)
	bootstrapHTML, err := publicBootstrapHTML(metadata, bootstrap)
	if err != nil {
		return nil, nil, err
	}
	replacements := map[string]string{
		"__PAGE_TITLE__":        html.EscapeString(metadata.Title),
		"__PAGE_DESCRIPTION__":  html.EscapeString(metadata.Description),
		"__ROBOTS__":            metadata.Robots,
		"__TWITTER_CARD__":      "summary_large_image",
		"<!--PUBLIC_META-->":    extraHead,
		"<!--PUBLIC_CONTENT-->": string(content),
		"<!--PUBLIC_DATA-->":    bootstrapHTML,
		cspNoncePlaceholder:     "",
	}
	body := string(indexHTML)
	for from, to := range replacements {
		body = strings.ReplaceAll(body, from, to)
	}
	return []byte(body), jsonLD, nil
}

func publicMetadataHTML(metadata publicPageMetadata, jsonLD []byte) string {
	var result strings.Builder
	if metadata.Canonical != "" {
		_, _ = result.WriteString(`<link rel="canonical" href="` + html.EscapeString(metadata.Canonical) + `" />`)
		_, _ = result.WriteString(`<meta property="og:url" content="` + html.EscapeString(metadata.Canonical) + `" />`)
	}
	if metadata.Image != "" {
		_, _ = result.WriteString(`<meta property="og:image" content="` + html.EscapeString(metadata.Image) + `" />`)
		_, _ = result.WriteString(`<meta property="og:image:width" content="1200" />`)
		_, _ = result.WriteString(`<meta property="og:image:height" content="630" />`)
		_, _ = result.WriteString(`<meta name="twitter:image" content="` + html.EscapeString(metadata.Image) + `" />`)
	}
	_, _ = result.WriteString(`<script type="application/ld+json">` + string(jsonLD) + `</script>`)
	return result.String()
}

func publicBootstrapHTML(metadata publicPageMetadata, value any) (string, error) {
	availability, err := json.Marshal(struct {
		ActivityEnabled bool `json:"activityEnabled"`
		AllTimeEnabled  bool `json:"allTimeEnabled"`
	}{ActivityEnabled: metadata.ActivityEnabled, AllTimeEnabled: metadata.AllTimeEnabled})
	if err != nil {
		return "", err
	}
	result := `<template id="public-page-config">` + string(availability) + `</template>`
	if metadata.BootstrapID == "" || value == nil {
		return result, nil
	}
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return result + `<template id="` + html.EscapeString(metadata.BootstrapID) + `">` + string(data) + `</template>`, nil
}

func rootPageContent(contentTemplate *template.Template, options PublicPageOptions) []byte {
	var result bytes.Buffer
	_ = contentTemplate.Execute(&result, struct{ Activity, AllTime bool }{
		Activity: options.ActivityEnabled, AllTime: options.AllTimeEnabled,
	})
	return result.Bytes()
}

func activityPageContent(
	contentTemplate *template.Template,
	activity publicActivityResponse,
	showAllTime bool,
) []byte {
	var result bytes.Buffer
	_ = contentTemplate.Execute(&result, struct {
		publicActivityResponse

		ShowAllTime bool
	}{publicActivityResponse: activity, ShowAllTime: showAllTime})
	return result.Bytes()
}

func allTimePageContent(
	contentTemplate *template.Template,
	activity publicAllTimeActivityResponse,
	showActivity bool,
) []byte {
	var result bytes.Buffer
	_ = contentTemplate.Execute(&result, struct {
		publicAllTimeActivityResponse

		ShowActivity bool
	}{publicAllTimeActivityResponse: activity, ShowActivity: showActivity})
	return result.Bytes()
}
