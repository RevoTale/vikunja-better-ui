package main

import (
	"maps"
	"testing"
)

func TestGeneratedSnapshotTracksContentAndAddedFiles(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	writeFixture(t, directory, "generated.go", "original")
	before, err := generatedSnapshot([]string{directory})
	if err != nil {
		t.Fatal(err)
	}
	writeFixture(t, directory, "generated.go", "modified")
	changed, err := generatedSnapshot([]string{directory})
	if err != nil || maps.Equal(before, changed) {
		t.Fatalf("content change was missed: %v", err)
	}
	writeFixture(t, directory, "generated.go", "original")
	writeFixture(t, directory, "new.go", "new file")
	added, err := generatedSnapshot([]string{directory})
	if err != nil || maps.Equal(before, added) {
		t.Fatalf("new file was missed: %v", err)
	}
}
