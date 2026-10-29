package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func toolRoot(t *testing.T) string {
	t.Helper()
	if os.Getenv("QUALITY_TOOL_TESTS") != "1" {
		t.Skip("real tool probes run in task quality:test")
	}
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	return root
}

func toolOutput(t *testing.T, directory string, want int, command string, args ...string) string {
	t.Helper()
	//nolint:gosec // Commands and arguments are fixed by quality-gate test cases, never application input.
	cmd := exec.CommandContext(t.Context(), command, args...)
	cmd.Dir = directory
	output, err := cmd.CombinedOutput()
	if cmd.ProcessState == nil || cmd.ProcessState.ExitCode() != want {
		t.Fatalf("%s %v: want status %d, got %v\n%s", command, args, want, err, output)
	}
	return string(output)
}

func contains(t *testing.T, output, expected string) {
	t.Helper()
	if !strings.Contains(output, expected) {
		t.Fatalf("missing %q in %s", expected, output)
	}
}

func lintFixture(t *testing.T, rule, body string, want int) string {
	t.Helper()
	root := toolRoot(t)
	directory := t.TempDir()
	writeFixture(t, directory, "go.mod", "module fixture\n\ngo 1.27.0\n")
	writeFixture(t, directory, "fixture.go", "// Package fixture exercises quality gates.\npackage fixture\n"+body)
	return toolOutput(t, directory, want, "golangci-lint", "run", "--config",
		filepath.Join(root, ".golangci.yml"), "--enable-only="+rule, "./...")
}

func branching(count int) string {
	var body strings.Builder
	body.WriteString("func Value(value int) int {\n")
	for index := range count {
		fmt.Fprintf(&body, "if value == %d { value++ }\n", index)
	}
	body.WriteString("return value\n}\n")
	return body.String()
}

func TestGoComplexityBoundaries(t *testing.T) {
	for _, scenario := range []struct {
		rule     string
		accepted int
	}{{"gocyclo", 14}, {"gocognit", 20}} {
		lintFixture(t, scenario.rule, branching(scenario.accepted), 0)
		contains(t, lintFixture(t, scenario.rule, branching(scenario.accepted+1), 1), scenario.rule)
	}
}

func TestGoFunctionAndLineLimits(t *testing.T) {
	lintFixture(t, "funlen,lll", "// Value returns its input.\nfunc Value(value int) int { return value }\n", 0)
	contains(t, lintFixture(t, "funlen",
		"func Value() int {\n"+strings.Repeat("// explanation\n", 61)+"return 1\n}\n", 1), "too long")
	contains(t, lintFixture(t, "funlen",
		"func Value(v int) int { "+strings.Repeat("v++;", 41)+" return v }", 1), "too many statements")
	contains(t, lintFixture(t, "lll", "// "+strings.Repeat("x", 118)+"\nfunc Value() int { return 1 }\n", 1), "lll")
}

func TestGoSuppressions(t *testing.T) {
	for _, suppression := range []string{
		"//nolint", "//nolint:errcheck", "//nolint:errcheck // Nothing here actually needs suppression.",
	} {
		contains(t, lintFixture(t, "nolintlint,errcheck", suppression+"\nfunc Value() int { return 1 }\n", 1), "nolintlint")
	}
}

func TestRealFormatterAndModernizationGate(t *testing.T) {
	toolRoot(t)
	directory := t.TempDir()
	writeFixture(t, directory, "go.mod", "module fixture\n\ngo 1.27.0\n")
	writeFixture(t, directory, "example.go", "package example\nfunc Value( )interface{} { return nil }\n")
	for _, args := range [][]string{{"gofmt", "-d", "example.go"}, {"go", "fix", "-diff", "./..."}} {
		//nolint:gosec // The table above contains only the formatter and modernization probes.
		command := exec.CommandContext(t.Context(), args[0], args[1:]...)
		command.Dir = directory
		var output bytes.Buffer
		code, err := emptyOutput(command, &output, io.Discard)
		if err != nil || code != 1 {
			t.Fatalf("code=%d err=%v", code, err)
		}
		contains(t, output.String(), "@@")
	}
}

func TestGoDocumentationAndDependencies(t *testing.T) {
	root := toolRoot(t)
	directory := t.TempDir()
	writeFixture(t, directory, "go.mod", "module github.com/RevoTale/vikunja-better-ui\n\ngo 1.27.0\n")
	writeFixture(t, directory, "internal/graphql/value.go", "package graphql\nconst Value = 1\n")
	writeFixture(t, directory, "internal/service/value.go",
		"package service\nimport \"github.com/RevoTale/vikunja-better-ui/internal/graphql\"\n"+
			"func Value() int { return graphql.Value }\n")
	output := toolOutput(t, directory, 1, "golangci-lint", "run", "--config",
		filepath.Join(root, ".golangci.yml"), "--enable-only=revive,depguard", "./...")
	for _, rule := range []string{"package-comments", "exported", "depguard"} {
		contains(t, output, rule)
	}
}
