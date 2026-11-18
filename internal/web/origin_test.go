package web

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestDirectBrowserOriginRequiresTheLocalSocket(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ host, local, want string }{
		{"10.77.0.20:8080", "10.77.0.20:8080", "http://10.77.0.20:8080"},
		{"[fd00::20]", "[fd00::20]:80", "http://[fd00::20]"},
		{"example.test", "10.77.0.20:80", ""},
		{"10.77.0.20:8081", "10.77.0.20:8080", ""},
		{"192.0.2.10", "192.0.2.10:80", ""},
	} {
		ip, err := net.ResolveTCPAddr("tcp", tc.local)
		if err != nil {
			t.Fatal(err)
		}
		ctx := context.WithValue(t.Context(), http.LocalAddrContextKey, ip)
		request := httptest.NewRequestWithContext(ctx, http.MethodPost, "http://"+tc.host+"/graphql", nil)
		request.Header.Set("X-Forwarded-Host", "example.test")
		request.Header.Set("X-Forwarded-Proto", "https")
		origin := BrowserOrigin(nil, request)
		if (tc.want == "" && origin != nil) || (tc.want != "" && (origin == nil || origin.String() != tc.want)) {
			t.Errorf("host %s on %s: origin %v, want %q", tc.host, tc.local, origin, tc.want)
		}
		fixed := &url.URL{Scheme: "https", Host: "better.example"}
		if BrowserOrigin(fixed, request) != fixed {
			t.Fatal("configured HTTPS origin must take precedence over the internal transport")
		}
	}
}
