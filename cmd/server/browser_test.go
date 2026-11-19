package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/config"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const privateOrigin = "http://10.77.0.20:8080"

func TestBrowserSessionsUseTheirOwnVikunjaCredential(t *testing.T) {
	t.Parallel()
	upstream := httptest.NewServer(http.HandlerFunc(personalTokenFixture))
	t.Cleanup(upstream.Close)
	secret := []byte(rand.Text() + rand.Text())
	first := newBrowserTestApp(t, upstream.URL, secret)
	redeployed := newBrowserTestApp(t, upstream.URL, secret)
	for _, name := range []string{"alice", "bob"} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			cookie := browserLogin(t, first, name)
			const query = `{"query":"{session{authenticated vikunjaUser{username}}}"}`
			response := browserRequest(t, redeployed, "/graphql", query, cookie)
			if !strings.Contains(response.Body.String(), `"username":"`+name+`"`) {
				t.Fatal("redeployed session did not read the expected profile")
			}
			response = browserRequest(t, redeployed, "/media/tasks/1/attachments/1", "", cookie)
			want := http.StatusForbidden
			if name == "alice" {
				want = http.StatusPartialContent
			}
			if response.Code != want {
				t.Fatalf("attachment status = %d, want %d", response.Code, want)
			}
		})
	}
}

func TestActiveWorkAliasesShareOnlyTheirOperationRead(t *testing.T) {
	t.Parallel()
	var reads atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v2/tasks" || r.Header.Get("Authorization") != "Bearer tk_alice" {
			personalTokenFixture(w, r)
			return
		}
		reads.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"items":[],"page":1,"per_page":1000,"total":0,"total_pages":0}`)
	}))
	t.Cleanup(upstream.Close)
	server := newBrowserTestApp(t, upstream.URL, []byte(rand.Text()+rand.Text()))
	cookie := browserLogin(t, server, "alice")
	const query = `{"query":"{sidebar:activeWorkTaskCount mobile:activeWorkTaskCount}"}`
	for sequence := int32(1); sequence <= 2; sequence++ {
		response := browserRequest(t, server, "/graphql", query, cookie)
		body := response.Body.String()
		if !strings.Contains(body, `"sidebar":0`) || !strings.Contains(body, `"mobile":0`) {
			t.Fatalf("unexpected GraphQL response: %s", body)
		}
		if total := reads.Load(); total != sequence {
			t.Fatalf("after %d operations got %d upstream reads", sequence, total)
		}
	}
}

func newBrowserTestApp(t *testing.T, upstreamURL string, secret []byte) http.Handler {
	t.Helper()
	endpoint, err := url.Parse(upstreamURL)
	if err != nil {
		t.Fatal(err)
	}
	configured := config.Config{
		AllowedOrigin: &url.URL{Scheme: "http", Host: "10.77.0.20:8080"},
		VikunjaURL:    endpoint, VikunjaPublicURL: endpoint, VikunjaAPIToken: "tk_" + rand.Text(),
		SessionSecret: secret, Environment: config.EnvironmentProduction,
	}
	sessions, err := auth.NewSessionManager(secret, upstreamURL, time.Now, rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	client := vikunja.NewClient(endpoint, "")
	return applicationRoutes(configured, slog.New(slog.DiscardHandler), client, sessions, time.Now)
}

func personalTokenFixture(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer tk_")
	if name != "alice" && name != "bob" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if r.URL.Path == "/api/v2/user" {
		w.Header().Set("Content-Type", "application/json")
		id := int64(1)
		if name == "bob" {
			id = 2
		}
		if err := json.NewEncoder(w).Encode(vikunja.User{ID: id, Username: name}); err != nil {
			http.Error(w, "fixture write failed", http.StatusInternalServerError)
		}
		return
	}
	if name == "alice" && r.URL.Path == "/api/v2/tasks/1/attachments/1" {
		w.Header().Set("Content-Type", "video/mp4")
		w.Header().Set("Content-Range", "bytes 0-3/8")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = io.WriteString(w, "data")
		return
	}
	w.WriteHeader(http.StatusForbidden)
}

func browserLogin(t *testing.T, h http.Handler, name string) []*http.Cookie {
	t.Helper()
	body := fmt.Sprintf(`{"query":"mutation($input:LoginInput!){login(input:$input){session{authenticated}}}",
		"variables":{"input":{"token":"tk_%s"}}}`, name)
	response := browserRequest(t, h, "/graphql", body, nil)
	result := response.Result()
	defer func() { _ = result.Body.Close() }()
	cookies := result.Cookies()
	if len(cookies) != 2 || cookies[0].Secure || !cookies[0].HttpOnly || cookies[1].Secure || !cookies[1].HttpOnly ||
		!strings.Contains(response.Body.String(), `"authenticated":true`) {
		t.Fatal("private HTTP login did not issue a usable host-only session")
	}
	return cookies
}

func browserRequest(
	t *testing.T, h http.Handler, path, body string, cookies []*http.Cookie,
) *httptest.ResponseRecorder {
	t.Helper()
	method := http.MethodPost
	if body == "" {
		method = http.MethodGet
	}
	request := httptest.NewRequestWithContext(t.Context(), method, privateOrigin+path, strings.NewReader(body))
	request.Header.Set("Origin", privateOrigin)
	request.Header.Set("Content-Type", "application/json")
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	writer := httptest.NewRecorder()
	h.ServeHTTP(writer, request)
	return writer
}
