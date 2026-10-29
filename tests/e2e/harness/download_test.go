package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestDownloadsAreCachedAndDigestChecked(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("release"))
	}))
	t.Cleanup(server.Close)
	path := filepath.Join(t.TempDir(), "release.zip")
	if err := download(t.Context(), server.URL, path); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256([]byte("release"))
	if err := verifyDigest(path, hex.EncodeToString(digest[:])); err != nil {
		t.Fatal(err)
	}
	if err := verifyDigest(path, "wrong"); err == nil {
		t.Fatal("accepted corrupt artifact")
	}
	server.Close()
	if err := download(t.Context(), server.URL, path); err != nil {
		t.Fatal("failed to use cache", err)
	}
}

func TestExtractionOnlyWritesRequestedBinary(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	file, err := os.CreateTemp(directory, "archive-*.zip")
	if err != nil {
		t.Fatal(err)
	}
	archive := file.Name()
	writer := zip.NewWriter(file)
	for _, name := range []string{"binary", "../escaped"} {
		entry, createErr := writer.Create(name)
		if createErr != nil {
			t.Fatal(createErr)
		}
		if _, err = entry.Write([]byte("binary bytes")); err != nil {
			t.Fatal(err)
		}
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err = file.Close(); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(directory, "executable")
	if err = extractBinary(archive, "binary", target); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(filepath.Join(filepath.Dir(directory), "escaped")); !os.IsNotExist(err) {
		t.Fatal("extracted another entry")
	}
	digest := sha256.Sum256([]byte("binary bytes"))
	if err = verifyDigest(target, hex.EncodeToString(digest[:])); err != nil {
		t.Fatal(err)
	}
}
