package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"io"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	certPath            = "/tmp/smoke-ca.pem"
	keyPath             = "/tmp/smoke-key.pem"
	probeTimeout        = 2 * time.Second
	serverTimeout       = 10 * time.Second
	certificateLifetime = 24 * time.Hour
)

func certificates(directory, hostname string) error {
	const serialBits = 128
	const publicCertificateMode = 0o644
	const privateKeyMode = 0o600
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), serialBits))
	if err != nil {
		return err
	}
	certificate := &x509.Certificate{
		SerialNumber: serial, Subject: pkix.Name{CommonName: hostname}, DNSNames: []string{hostname},
		NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(certificateLifetime),
		KeyUsage:    x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IsCA:        true, BasicConstraintsValid: true}
	der, err := x509.CreateCertificate(rand.Reader, certificate, certificate, &key.PublicKey, key)
	if err != nil {
		return err
	}
	encodedKey, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return err
	}
	publicPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if err = os.WriteFile(filepath.Join(directory, "cert.pem"), publicPEM, publicCertificateMode); err != nil {
		return err
	}
	privatePEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: encodedKey})
	return os.WriteFile(filepath.Join(directory, "key.pem"), privatePEM, privateKeyMode)
}

func upstreamHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/v2/info" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = io.WriteString(w, `{"version":"v2.7.0"}`)
}

func serve(ctx context.Context) error {
	server := &http.Server{Addr: ":3456", Handler: http.HandlerFunc(upstreamHandler),
		ReadHeaderTimeout: probeTimeout, ReadTimeout: serverTimeout, WriteTimeout: serverTimeout,
		TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12}}
	go func() { <-ctx.Done(); _ = server.Close() }()
	err := server.ListenAndServeTLS(certPath, keyPath)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func probe(ctx context.Context, baseURL string) error {
	client := &http.Client{Timeout: probeTimeout, Transport: &http.Transport{Proxy: nil}}
	if strings.HasPrefix(baseURL, "https:") {
		certificate, err := os.ReadFile(certPath)
		if err != nil {
			return err
		}
		roots := x509.NewCertPool()
		if !roots.AppendCertsFromPEM(certificate) {
			return errors.New("invalid smoke certificate")
		}
		client.Transport = &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: roots}}
		_, err = probeBody(ctx, client, baseURL+"/api/v2/info")
		return err
	}
	health, err := probeBody(ctx, client, baseURL+"/healthz")
	if err != nil {
		return err
	}
	if strings.TrimSpace(health) != "ok" {
		return errors.New("unexpected health response")
	}
	page, err := probeBody(ctx, client, baseURL+"/")
	if err != nil {
		return err
	}
	if !strings.Contains(page, `<div id="root">`) ||
		!strings.Contains(page, `type="module"`) || !strings.Contains(page, `src="/assets/`) {
		return errors.New("missing embedded frontend root")
	}
	return nil
}

//nolint:gosec // The test CLI probes the runner's fixture URL without credentials or application input.
func probeBody(ctx context.Context, client *http.Client, url string) (string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return "", errors.New("smoke endpoint is not ready")
	}
	const responseLimit = 4 << 20
	body, err := io.ReadAll(io.LimitReader(response.Body, responseLimit))
	return string(body), err
}
