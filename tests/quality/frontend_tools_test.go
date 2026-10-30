package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func biomeFixture(t *testing.T, source string, want int) string {
	t.Helper()
	root := toolRoot(t)
	//nolint:usetesting // Biome must resolve the probe through the real frontend source configuration.
	directory, err := os.MkdirTemp(filepath.Join(root, "frontend/src"), "quality-probe-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(directory) })
	writeFixture(t, directory, "probe.ts", source)
	return toolOutput(t, filepath.Join(root, "frontend"), want, "pnpm", "exec", "biome", "lint",
		filepath.Join(directory, "probe.ts"))
}

func longFrontendFile() string {
	var body strings.Builder
	for index := range 301 {
		fmt.Fprintf(&body, "export const value%d = %d;\n", index, index)
	}
	return body.String()
}

func TestBiomeSizeAndComplexity(t *testing.T) {
	biomeFixture(t, "export const value = 1;\n", 0)
	contains(t, biomeFixture(t, longFrontendFile(), 1), "noExcessiveLinesPerFile")
	contains(t, biomeFixture(t, "export function value(value: number) {\n"+
		strings.Repeat("  value += 1;\n", 81)+"return value;\n}\n", 1), "noExcessiveLinesPerFunction")
	for _, scenario := range []struct{ count, status int }{{15, 0}, {16, 1}} {
		var body strings.Builder
		body.WriteString("export function calculate(value: number) {\n")
		for index := range scenario.count {
			fmt.Fprintf(&body, "if (value === %d) value++;\n", index)
		}
		body.WriteString("return value;\n}\n")
		output := biomeFixture(t, body.String(), scenario.status)
		if scenario.status != 0 {
			contains(t, output, "noExcessiveCognitiveComplexity")
		}
	}
}

func readJSON(t *testing.T, path string, target any) {
	t.Helper()
	//nolint:gosec // Callers supply fixed repository config paths for the quality probes.
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(data, target); err != nil {
		t.Fatal(err)
	}
}

func TestFrontendLintRejectsWarnings(t *testing.T) {
	root := toolRoot(t)
	directory := t.TempDir()
	writeFixture(t, directory, "biome.json", `{
		"formatter":{"enabled":false},"assist":{"enabled":false},
		"linter":{"rules":{"preset":"recommended","correctness":{"noUnusedVariables":"warn"}}}
	}`)
	var manifest struct{ Scripts struct{ Lint string } }
	readJSON(t, filepath.Join(root, "frontend/package.json"), &manifest)
	command := strings.Fields(manifest.Scripts.Lint)
	if len(command) == 0 || command[len(command)-1] != "." {
		t.Fatal("lint must validate the entire frontend")
	}
	args := append([]string{"exec"}, command[:len(command)-1]...)
	args = append(args, "--config-path", directory, directory)
	writeFixture(t, directory, "probe.ts", "export const value = 1;\n")
	toolOutput(t, filepath.Join(root, "frontend"), 0, "pnpm", args...)
	writeFixture(t, directory, "probe.ts", "const unused = 1;\nexport {};\n")
	contains(t, toolOutput(t, filepath.Join(root, "frontend"), 1, "pnpm", args...), "noUnusedVariables")
}

func TestBiomeGeneratedScope(t *testing.T) {
	root := toolRoot(t)
	directory := t.TempDir()
	var config map[string]json.RawMessage
	readJSON(t, filepath.Join(root, "frontend/biome.json"), &config)
	config["vcs"] = json.RawMessage(`{"enabled":false}`)
	data, err := json.Marshal(config)
	if err != nil {
		t.Fatal(err)
	}
	writeFixture(t, directory, "biome.json", string(data))
	for _, name := range []string{"src/routeTree.gen.ts", "src/graphql/generated.ts", "src/components/ui/button.tsx"} {
		writeFixture(t, directory, name, longFrontendFile())
	}
	writeFixture(t, directory, "src/handwritten.ts", "export const value = 1;\n")
	args := []string{"exec", "biome", "lint", "--config-path", directory, directory}
	toolOutput(t, filepath.Join(root, "frontend"), 0, "pnpm", args...)
	writeFixture(t, directory, "src/handwritten.ts", longFrontendFile())
	contains(t, toolOutput(t, filepath.Join(root, "frontend"), 1, "pnpm", args...), "noExcessiveLinesPerFile")
}
