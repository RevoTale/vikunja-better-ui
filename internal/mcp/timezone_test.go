package mcp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestContextTimezoneFallback(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, profile, fallback, zone, source string
		owner                                 int64
		ready                                 bool
	}{
		{"bot fallback", "", "Europe/Kyiv", "Europe/Kyiv", "BOT_FALLBACK", 9, true},
		{"bot native wins", "UTC", "Europe/Kyiv", "UTC", "VIKUNJA", 9, true},
		{"same native and fallback", "Europe/Kyiv", "Europe/Kyiv", "Europe/Kyiv", "VIKUNJA", 9, true},
		{"bot no fallback", "", "", "", "UNAVAILABLE", 9, false},
		{"human no timezone", "", "Europe/Kyiv", "", "UNAVAILABLE", 0, false},
		{"bot invalid native", "Invalid/Zone", "Europe/Kyiv", "Invalid/Zone", "VIKUNJA", 9, false},
		{"human native", "UTC", "Europe/Kyiv", "UTC", "VIKUNJA", 0, true},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			handler := timezoneHandler(t, test.owner, test.profile, test.fallback)
			response := callProtocol(handler, "tk_fixture",
				`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_context","arguments":{}}}`)
			var body struct {
				Result struct {
					Content struct {
						Timezone        string `json:"timezone"`
						TimezoneSource  string `json:"timezoneSource"`
						SchedulingReady bool   `json:"schedulingReady"`
					} `json:"structuredContent"`
				} `json:"result"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			got := body.Result.Content
			if got.Timezone != test.zone || got.TimezoneSource != test.source || got.SchedulingReady != test.ready {
				t.Fatalf("wrong timezone context: %s", response.Body)
			}
		})
	}
}

func TestCalendarUsesBotFallbackAcrossLocalMidnight(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name, zone, fallback, want string
		owner                      int64
	}{
		{"bot fallback", "", "Europe/Kyiv", `"date":"2026-11-10"`, 9},
		{"native wins", "UTC", "Europe/Kyiv", `"date":"2026-11-09"`, 9},
		{"bot missing", "", "", `"isError":true`, 9},
		{"human missing", "", "Europe/Kyiv", `"isError":true`, 0},
		{"bot invalid", "Invalid/Zone", "Europe/Kyiv", `"isError":true`, 9},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			response := callProtocol(timezoneHandler(t, test.owner, test.zone, test.fallback), "tk_fixture",
				`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_agenda","arguments":{}}}`)
			if !strings.Contains(response.Body.String(), test.want) {
				t.Fatalf("wrong calendar date/readiness: %s", response.Body)
			}
		})
	}
}

func TestActivityUsesBotFallback(t *testing.T) {
	t.Parallel()
	for _, period := range []string{"RECENT", "ALL_TIME"} {
		t.Run(period, func(t *testing.T) {
			t.Parallel()
			response := callProtocol(timezoneHandler(t, 9, "", "Europe/Kyiv"), "tk_fixture",
				`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_activity",`+
					`"arguments":{"period":"`+period+`"}}}`)
			var body struct {
				Result struct {
					IsError bool           `json:"isError"`
					Content activityOutput `json:"structuredContent"`
				} `json:"result"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Result.IsError || body.Result.Content.Timezone != "Europe/Kyiv" {
				t.Fatalf("activity ignored fallback: %s", response.Body)
			}
		})
	}
}

func timezoneHandler(t *testing.T, owner int64, zone, fallback string) http.Handler {
	t.Helper()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet && r.URL.Path != "/api/v2/mcp" {
			t.Errorf("read changed upstream data: %s %s", r.Method, r.URL.Path)
		}
		switch r.URL.Path {
		case "/api/v2/mcp":
			w.WriteHeader(http.StatusAccepted)
		case "/api/v2/user":
			_ = json.NewEncoder(w).Encode(map[string]any{"id": 1, "username": "bot-fixture",
				"bot_owner_id": owner, "settings": map[string]any{"timezone": zone}})
		case "/api/v2/projects", "/api/v2/labels", "/api/v2/tasks":
			pageSize := 1000
			if raw := r.URL.Query().Get("per_page"); raw != "" {
				pageSize, _ = strconv.Atoi(raw)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"items": []any{}, "page": 1,
				"per_page": pageSize, "total": 0, "total_pages": 0})
		default:
			t.Errorf("unexpected upstream request: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(upstream.Close)
	return fallbackHandler(t, upstream.URL, fallback)
}

func fallbackHandler(t *testing.T, rawURL, fallback string) http.Handler {
	t.Helper()
	address, err := url.Parse(rawURL)
	if err != nil {
		t.Fatal(err)
	}
	return NewHandler(Options{Upstream: address, PublicUpstream: address, FallbackTimezone: fallback,
		Secret: []byte("fixture-mcp-secret-not-a-real-credential"),
		Now:    func() time.Time { return time.Date(2026, time.November, 9, 23, 30, 0, 0, time.UTC) }})
}
