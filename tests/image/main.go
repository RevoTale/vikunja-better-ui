// Command image smoke-tests the production image with an isolated TLS upstream.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	var err error
	switch {
	case len(os.Args) > 1 && os.Args[1] == "serve":
		err = serve(ctx)
	case len(os.Args) > 2 && os.Args[1] == "probe":
		err = probe(ctx, os.Args[2])
	default:
		err = smoke(ctx)
	}
	stop()
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
