package mcp

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func BenchmarkMCPDiscovery(b *testing.B) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	defer upstream.Close()
	address, err := url.Parse(upstream.URL)
	if err != nil {
		b.Fatal(err)
	}
	handler := NewHandler(Options{Upstream: address, PublicUpstream: address, Now: time.Now,
		Secret: []byte("benchmark-only")})
	b.ReportAllocs()
	for b.Loop() {
		response := callProtocol(handler, "tk_fixture", `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)
		if response.Code != http.StatusOK {
			b.Fatal(response.Code)
		}
	}
}
