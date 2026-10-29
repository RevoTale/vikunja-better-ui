package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestGeneratedCertificateMatchesUpstream(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	if err := certificates(directory, "smoke-upstream"); err != nil {
		t.Fatal(err)
	}
	pair, err := tls.LoadX509KeyPair(filepath.Join(directory, "cert.pem"), filepath.Join(directory, "key.pem"))
	if err != nil {
		t.Fatal(err)
	}
	certificate, err := x509.ParseCertificate(pair.Certificate[0])
	if err != nil {
		t.Fatal(err)
	}
	if err = certificate.VerifyHostname("smoke-upstream"); err != nil {
		t.Fatal(err)
	}
	if err = certificate.VerifyHostname("unrelated"); err == nil {
		t.Fatal("certificate accepts unrelated hostname")
	}
	roots := x509.NewCertPool()
	roots.AppendCertsFromPEM(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: pair.Certificate[0]}))
	if _, err = certificate.Verify(x509.VerifyOptions{DNSName: "smoke-upstream", Roots: roots}); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(directory, "key.pem"))
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatal("private key has unsafe permissions", err)
	}
}

func TestProbeRequiresHealthyAppAndEmbeddedFrontend(t *testing.T) {
	t.Parallel()
	const assets = `<script type="module" src="/assets/main.js"></script>`
	for _, scenario := range []struct {
		health, page string
		valid        bool
	}{
		{"ok\n", assets + `<div id="root"></div>`, true},
		{"ok\n", assets + `<div id="root"><main>Landing page</main></div>`, true},
		{"ok\n", `<div id="root"></div>`, false},
		{"bad", assets + `<div id="root"></div>`, false},
		{"ok\n", "missing frontend", false},
	} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body := scenario.page
			if r.URL.Path == "/healthz" {
				body = scenario.health
			}
			_, _ = w.Write([]byte(body))
		}))
		err := probe(t.Context(), server.URL)
		server.Close()
		if (err == nil) != scenario.valid {
			t.Fatalf("valid=%v err=%v", scenario.valid, err)
		}
	}
}

func TestSyntheticUpstreamOnlyServesInfo(t *testing.T) {
	t.Parallel()
	for _, path := range []string{"/api/v2/info", "/private"} {
		response := httptest.NewRecorder()
		upstreamHandler(response, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil))
		want := http.StatusNotFound
		if path == "/api/v2/info" {
			want = http.StatusOK
		}
		if response.Code != want {
			t.Fatalf("%s: %d", path, response.Code)
		}
	}
}
