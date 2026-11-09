// Package mcp exposes Better UI workflows through a caller-token-authenticated remote protocol.
package mcp

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	maxTokenBytes         = 4096
	maxBodyBytes          = 1 << 20
	callTimeout           = 30 * time.Second
	maxConcurrentRequests = 16
)

type callerKey struct{}

type caller struct {
	onRequestEnd func(func()) func() bool
	client       *vikunja.Client
	now          time.Time
	principal    string
	capabilities *service.CapabilityManager
	linker       service.ReferenceLinker
}

type handler struct {
	readers      chan struct{}
	upstream     *vikunja.Client
	now          func() time.Time
	protocol     http.Handler
	origin       *http.CrossOriginProtection
	secret       []byte
	capabilities *service.CapabilityManager
	policy       service.TaskReferencePolicy
}

// Options contains trusted deployment settings; caller tokens never come from this configuration.
type Options struct {
	Upstream       *url.URL
	PublicUpstream *url.URL
	AppURL         *url.URL
	Secret         []byte
	Logger         *slog.Logger
	Now            func() time.Time
}

// NewHandler creates a stateless HTTP endpoint using only each caller's upstream token.
func NewHandler(options Options) http.Handler {
	server := newServer()
	protocol := sdk.NewStreamableHTTPHandler(func(*http.Request) *sdk.Server { return server },
		&sdk.StreamableHTTPOptions{Stateless: true, JSONResponse: true, MaxRequestBodyBytes: maxBodyBytes,
			PropagateRequestCancellation: true})
	key := hmac.New(sha256.New, options.Secret)
	_, _ = key.Write([]byte("better-ui:mcp:capabilities:v1"))
	secret := key.Sum(nil)
	return &handler{readers: make(chan struct{}, maxConcurrentRequests),
		upstream: vikunja.NewClient(options.Upstream, "", vikunja.WithLogger(options.Logger),
			vikunja.WithPublicURL(options.PublicUpstream)), now: options.Now, protocol: protocol,
		origin: http.NewCrossOriginProtection(), secret: secret,
		capabilities: service.NewCapabilityManager(secret, options.Now),
		policy:       service.TaskReferencePolicy{BetterUI: options.AppURL, Vikunja: options.PublicUpstream}}
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Vary", "Authorization")
	if r.ContentLength > maxBodyBytes {
		http.Error(w, "Request is too large.", http.StatusRequestEntityTooLarge)
		return
	}
	select {
	case h.readers <- struct{}{}:
		defer func() { <-h.readers }()
	default:
		http.Error(w, "MCP is busy; retry later.", http.StatusServiceUnavailable)
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "Only POST is supported.", http.StatusMethodNotAllowed)
		return
	}
	if err := h.origin.Check(r); err != nil {
		http.Error(w, "Cross-origin request rejected.", http.StatusForbidden)
		return
	}
	token, ok := requestToken(r)
	if !ok {
		w.Header().Set("WWW-Authenticate", "Bearer")
		http.Error(w, "A Vikunja API token is required.", http.StatusUnauthorized)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), callTimeout)
	defer cancel()
	client := h.upstream.ForToken(token)
	if err := client.CheckMCPAccess(ctx); err != nil {
		writeAuthError(w, err)
		return
	}
	key := hmac.New(sha256.New, h.secret)
	_, _ = key.Write([]byte(token))
	requestContext := ctx
	onRequestEnd := func(cancel func()) func() bool {
		if requestContext.Err() != nil {
			cancel()
		}
		return context.AfterFunc(requestContext, cancel)
	}
	ctx = context.WithValue(ctx, callerKey{}, &caller{onRequestEnd: onRequestEnd, client: client, now: h.now(),
		principal: "mcp:" + hex.EncodeToString(key.Sum(nil)), capabilities: h.capabilities,
		linker: service.ReferenceLinker{Policy: h.policy, Tasks: client, Relations: client}})
	h.protocol.ServeHTTP(privateResponse{ResponseWriter: w}, r.WithContext(ctx))
}

type privateResponse struct{ http.ResponseWriter }

func (w privateResponse) WriteHeader(status int) {
	w.Header().Set("Cache-Control", "private, no-store")
	w.ResponseWriter.WriteHeader(status)
}

func (w privateResponse) Write(body []byte) (int, error) {
	w.Header().Set("Cache-Control", "private, no-store")
	return w.ResponseWriter.Write(body)
}

func (w privateResponse) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func requestToken(r *http.Request) (string, bool) {
	values := r.Header.Values("Authorization")
	if len(values) != 1 || len(values[0]) > maxTokenBytes {
		return "", false
	}
	token, ok := strings.CutPrefix(values[0], "Bearer tk_")
	if !ok || token == "" || strings.ContainsAny(token, " \t\r\n,") {
		return "", false
	}
	return "tk_" + token, true
}

func writeAuthError(w http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	var upstream *vikunja.Error
	if errors.As(err, &upstream) &&
		(upstream.Status == http.StatusUnauthorized || upstream.Status == http.StatusForbidden) {
		status = upstream.Status
	}
	if status == http.StatusUnauthorized {
		w.Header().Set("WWW-Authenticate", "Bearer")
	}
	http.Error(w, "Vikunja MCP access could not be authorized.", status)
}

func requestCaller(ctx context.Context) (*caller, error) {
	value, ok := ctx.Value(callerKey{}).(*caller)
	if !ok || value == nil {
		return nil, errors.New("authenticated MCP request required")
	}
	return value, nil
}
