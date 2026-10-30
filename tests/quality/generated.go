package main

import (
	"context"
	"crypto/sha256"
	"errors"
	"io"
	"io/fs"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
)

func generatedSnapshot(paths []string) (map[string][sha256.Size]byte, error) {
	snapshot := make(map[string][sha256.Size]byte)
	for _, root := range paths {
		err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if !entry.Type().IsRegular() {
				return nil
			}
			//nolint:gosec // Only regular files under the fixed generated-source paths are hashed.
			data, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			snapshot[path] = sha256.Sum256(data)
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return snapshot, nil
}

func checkGenerated(ctx context.Context, stdout, stderr io.Writer) error {
	paths := []string{
		"internal/graphql/generated", "internal/graphql/model", "internal/graphql/resolver",
		"frontend/src/graphql", "frontend/src/routeTree.gen.ts",
	}
	before, err := generatedSnapshot(paths)
	if err != nil {
		return err
	}
	command := exec.CommandContext(ctx, "task", "gen")
	command.Stdout, command.Stderr = stdout, stderr
	if err = command.Run(); err != nil {
		return err
	}
	after, err := generatedSnapshot(paths)
	if err != nil {
		return err
	}
	if !maps.Equal(before, after) {
		return errors.New("generated files changed; run task gen and include the updated sources")
	}
	return nil
}

func checkBuild(ctx context.Context, stdout, stderr io.Writer) error {
	directory, err := os.MkdirTemp("", "vbu-build-")
	if err != nil {
		return err
	}
	defer func() { _ = os.RemoveAll(directory) }()
	//nolint:gosec // The output path is created by MkdirTemp; the build target is fixed.
	command := exec.CommandContext(ctx, "go", "build", "-o", filepath.Join(directory, "server"), "./cmd/server")
	command.Stdout, command.Stderr = stdout, stderr
	return command.Run()
}
