// Command harness owns isolated E2E tooling and process measurements.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	code := 1
	var err error
	switch {
	case len(os.Args) == 2 && os.Args[1] == "wait-postgres":
		err = waitPostgres(ctx, "postgres:5432")
		code = 0
	case len(os.Args) == 3 && os.Args[1] == "seed-discussion":
		err = seedDiscussion(ctx, os.Args[2])
		code = 0
	case len(os.Args) > 2 && os.Args[1] == "measure":
		code, err = measure(ctx, os.Args[2:], os.Stdout, os.Stderr)
	case len(os.Args) > 1 && os.Args[1] == runCommand:
		err = runHarness(ctx, os.Args[2:])
		code = 0
	default:
		err = errors.New("usage: harness run [playwright args...] | measure <command> [args...]")
	}
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		code = 1
	}
	stop()
	os.Exit(code)
}
