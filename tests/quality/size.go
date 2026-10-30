package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const maxGoLines = 500

func handwrittenGoLines(source string) (int, bool) {
	preamble := source
	if index := regexp.MustCompile(`(?m)^package\s`).FindStringIndex(source); index != nil {
		preamble = source[:index[0]]
	}
	if regexp.MustCompile(`(?m)^// Code generated .* DO NOT EDIT\.$`).MatchString(preamble) {
		return 0, true
	}
	lines := strings.Count(source, "\n")
	if source != "" && !strings.HasSuffix(source, "\n") {
		lines++
	}
	return lines, false
}

func oversizedGoFiles(directory string) ([]string, error) {
	var violations []string
	err := filepath.WalkDir(directory, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			name := entry.Name()
			if path != directory && (strings.HasPrefix(name, ".") ||
				name == "node_modules" || name == "vendor" || name == "dist") {
				return filepath.SkipDir
			}
			return nil
		}
		if !entry.Type().IsRegular() || filepath.Ext(path) != ".go" {
			return nil
		}
		//nolint:gosec // Paths come from walking the developer-selected checkout; symlinks are skipped.
		source, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if lines, generated := handwrittenGoLines(string(source)); !generated && lines > maxGoLines {
			violations = append(violations, fmt.Sprintf("%s: %d lines > %d", path, lines, maxGoLines))
		}
		return nil
	})
	return violations, err
}
