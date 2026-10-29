// Command quality checks handwritten Go size and rejects pending tool output.
package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
)

func main() {
	code, err := run(context.Background(), os.Args[1:], os.Stdout, os.Stderr)
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		code = 1
	}
	os.Exit(code)
}

func run(ctx context.Context, args []string, stdout, stderr io.Writer) (int, error) {
	if len(args) == 0 {
		return 1, errors.New("usage: quality size | empty-output <command> [args...]")
	}
	switch args[0] {
	case "generated-check":
		return 0, checkGenerated(ctx, stdout, stderr)
	case "build":
		return 0, checkBuild(ctx, stdout, stderr)
	case "size":
		violations, err := oversizedGoFiles(".")
		if err != nil {
			return 1, err
		}
		for _, violation := range violations {
			_, _ = fmt.Fprintln(stderr, violation)
		}
		if len(violations) > 0 {
			return 1, nil
		}
		return 0, nil
	case "empty-output":
		if len(args) == 1 {
			return 1, errors.New("empty-output needs a command")
		}
		//nolint:gosec // This developer CLI intentionally runs the explicitly supplied command without a shell.
		return emptyOutput(exec.CommandContext(ctx, args[1], args[2:]...), stdout, stderr)
	default:
		return 1, errors.New("unknown quality command")
	}
}

func emptyOutput(command *exec.Cmd, stdout, stderr io.Writer) (int, error) {
	var report bytes.Buffer
	command.Stdout, command.Stderr = &report, stderr
	err := command.Run()
	written, writeErr := io.Copy(stdout, &report)
	if writeErr != nil {
		return 1, writeErr
	}
	if failure, ok := errors.AsType[*exec.ExitError](err); ok {
		return failure.ExitCode(), nil
	}
	if err != nil {
		return 1, err
	}
	if written > 0 {
		return 1, nil
	}
	return 0, nil
}
