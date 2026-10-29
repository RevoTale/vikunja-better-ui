package main

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type releaseMetadata struct {
	Version               string                     `json:"version"`
	SigningKeyFingerprint string                     `json:"signingKeyFingerprint"`
	Architectures         map[string]releaseArtifact `json:"architectures"`
}

type releaseArtifact struct {
	URL           string `json:"url"`
	SignatureURL  string `json:"signatureUrl"`
	ArchiveSHA256 string `json:"archiveSha256"`
	BinarySHA256  string `json:"binarySha256"`
}

const (
	privateExecutableMode = 0o700
	downloadTimeout       = 2 * time.Minute
)

func (h *harness) localBinary(ctx context.Context) (string, error) {
	data, err := os.ReadFile("tests/e2e/harness/vikunja-2.7.0.json")
	if err != nil {
		return "", err
	}
	var metadata releaseMetadata
	if err = json.Unmarshal(data, &metadata); err != nil {
		return "", err
	}
	artifact, ok := metadata.Architectures[runtime.GOARCH]
	if !ok || runtime.GOOS != "linux" {
		return "", errors.New("unsupported E2E platform")
	}
	cache := filepath.Join(h.root, ".cache/e2e/vikunja-"+metadata.Version)
	if err = os.MkdirAll(cache, privateExecutableMode); err != nil {
		return "", err
	}
	archive := filepath.Join(cache, runtime.GOARCH+".zip")
	signature := archive + ".sig"
	if err = download(ctx, artifact.URL, archive); err != nil {
		return "", err
	}
	if err = download(ctx, artifact.SignatureURL, signature); err != nil {
		return "", err
	}
	if err = verifyDigest(archive, artifact.ArchiveSHA256); err != nil {
		return "", err
	}
	if err = h.verifySignature(ctx, metadata.SigningKeyFingerprint, archive, signature); err != nil {
		return "", err
	}
	binary := filepath.Join(h.directory, "vikunja")
	name := "vikunja-v" + metadata.Version + "-linux-" + runtime.GOARCH
	if err = extractBinary(archive, name, binary); err != nil {
		return "", err
	}
	if err = verifyDigest(binary, artifact.BinarySHA256); err != nil {
		return "", err
	}
	// Only the owner may execute the binary after its pinned digest and signature are verified.
	return binary, os.Chmod(binary, privateExecutableMode)
}

func download(ctx context.Context, url, path string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: downloadTimeout}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("release download: HTTP %d", response.StatusCode)
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".download-")
	if err != nil {
		return err
	}
	defer func() { _ = file.Close(); _ = os.Remove(file.Name()) }()
	if _, err = io.Copy(file, response.Body); err != nil {
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(file.Name(), path)
}

func verifyDigest(path, expected string) error {
	//nolint:gosec // The harness selects cache or temporary artifact paths for digest verification.
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()
	digest := sha256.New()
	if _, err = io.Copy(digest, file); err != nil {
		return err
	}
	if hex.EncodeToString(digest.Sum(nil)) != expected {
		return errors.New("vikunja artifact digest mismatch")
	}
	return nil
}

func extractBinary(archive, name, target string) error {
	reader, err := zip.OpenReader(archive)
	if err != nil {
		return err
	}
	defer func() { _ = reader.Close() }()
	input, err := reader.Open(name)
	if err != nil {
		return err
	}
	defer func() { _ = input.Close() }()
	//nolint:gosec // Target is chosen by the harness, never derived from an archive entry path.
	output, err := os.Create(target)
	if err != nil {
		return err
	}
	defer func() { _ = output.Close() }()
	_, err = io.Copy(output, input)
	return err
}

func (h *harness) verifySignature(ctx context.Context, fingerprint, archive, signature string) error {
	home := filepath.Join(h.directory, "gnupg")
	if err := os.Mkdir(home, privateExecutableMode); err != nil {
		return err
	}
	command := h.command(ctx, "gpg", "--batch", "--quiet", "--import", "tests/e2e/harness/vikunja-release-key.asc")
	command.Env = append(command.Env, "GNUPGHOME="+home)
	if err := command.Run(); err != nil {
		return err
	}
	command = h.command(ctx, "gpg", "--batch", "--with-colons", "--fingerprint")
	command.Env, command.Stdout = append(command.Env, "GNUPGHOME="+home), nil
	output, err := command.Output()
	if err != nil {
		return err
	}
	if !strings.Contains(string(output), "fpr:::::::::"+fingerprint+":") {
		return errors.New("vikunja release signing fingerprint mismatch")
	}
	command = h.command(ctx, "gpg", "--batch", "--quiet", "--verify", signature, archive)
	command.Env = append(command.Env, "GNUPGHOME="+home)
	return command.Run()
}
