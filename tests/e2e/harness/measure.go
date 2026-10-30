package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"
)

const (
	sampleInterval   = 250 * time.Millisecond
	kibPerMiB        = 1024.0
	secondsPrecision = 100.0
	memoryPrecision  = 10.0
)

type measurement struct {
	Seconds        float64  `json:"seconds"`
	PeakTreeRSSMiB *float64 `json:"peakTreeRssMiB"`
	Samples        int      `json:"samples"`
	Code           *int     `json:"code"`
	Signal         *string  `json:"signal"`
}

func measure(ctx context.Context, args []string, stdout, stderr io.Writer) (int, error) {
	if len(args) == 0 {
		return 1, errors.New("measurement requires a command")
	}
	//nolint:gosec // This developer tool runs the explicitly supplied command without shell interpretation.
	command := exec.CommandContext(ctx, args[0], args[1:]...)
	command.Stdout, command.Stderr = stdout, stderr
	command.Stdin = os.Stdin
	started := time.Now()
	if err := command.Start(); err != nil {
		return 1, err
	}
	metrics := sampleProcess(ctx, command)
	metrics.Seconds = math.Round(time.Since(started).Seconds()*secondsPrecision) / secondsPrecision
	code := command.ProcessState.ExitCode()
	if code < 0 {
		if status, ok := command.ProcessState.Sys().(syscall.WaitStatus); ok {
			name := signalName(status.Signal())
			metrics.Signal = &name
		}
		code = 1
	} else {
		metrics.Code = &code
	}
	return code, json.NewEncoder(stderr).Encode(metrics)
}

func signalName(signal syscall.Signal) string {
	names := map[syscall.Signal]string{
		syscall.SIGHUP: "SIGHUP", syscall.SIGINT: "SIGINT", syscall.SIGQUIT: "SIGQUIT",
		syscall.SIGILL: "SIGILL", syscall.SIGTRAP: "SIGTRAP", syscall.SIGABRT: "SIGABRT",
		syscall.SIGBUS: "SIGBUS", syscall.SIGFPE: "SIGFPE", syscall.SIGKILL: "SIGKILL",
		syscall.SIGUSR1: "SIGUSR1", syscall.SIGSEGV: "SIGSEGV", syscall.SIGUSR2: "SIGUSR2",
		syscall.SIGPIPE: "SIGPIPE", syscall.SIGALRM: "SIGALRM", syscall.SIGTERM: "SIGTERM",
		syscall.SIGSTKFLT: "SIGSTKFLT", syscall.SIGCHLD: "SIGCHLD", syscall.SIGCONT: "SIGCONT",
		syscall.SIGSTOP: "SIGSTOP", syscall.SIGTSTP: "SIGTSTP", syscall.SIGTTIN: "SIGTTIN",
		syscall.SIGTTOU: "SIGTTOU", syscall.SIGURG: "SIGURG", syscall.SIGXCPU: "SIGXCPU",
		syscall.SIGXFSZ: "SIGXFSZ", syscall.SIGVTALRM: "SIGVTALRM", syscall.SIGPROF: "SIGPROF",
		syscall.SIGWINCH: "SIGWINCH", syscall.SIGIO: "SIGIO", syscall.SIGPWR: "SIGPWR", syscall.SIGSYS: "SIGSYS",
	}
	if name, ok := names[signal]; ok {
		return name
	}
	return signal.String()
}

func sampleProcess(ctx context.Context, command *exec.Cmd) measurement {
	var metrics measurement
	sample := func() {
		output, err := exec.CommandContext(ctx, "ps", "-e", "-o", "pid=,ppid=,rss=").Output()
		if err != nil {
			return
		}
		rss := math.Round(float64(treeRSS(string(output), command.Process.Pid))/kibPerMiB*memoryPrecision) / memoryPrecision
		if metrics.PeakTreeRSSMiB == nil || rss > *metrics.PeakTreeRSSMiB {
			metrics.PeakTreeRSSMiB = &rss
		}
		metrics.Samples++
	}
	// Capture before waiting so even short commands get a sample.
	sample()
	done := make(chan struct{})
	go func() {
		_ = command.Wait()
		close(done)
	}()
	ticker := time.NewTicker(sampleInterval)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			return metrics
		case <-ticker.C:
			sample()
		}
	}
}

func treeRSS(output string, root int) int64 {
	type process struct {
		pid, parent int
		rss         int64
	}
	var rows []process
	for line := range strings.SplitSeq(output, "\n") {
		var row process
		if _, err := fmt.Sscan(line, &row.pid, &row.parent, &row.rss); err == nil {
			rows = append(rows, row)
		}
	}
	descendants := map[int]bool{root: true}
	for changed := true; changed; {
		changed = false
		for _, row := range rows {
			if descendants[row.parent] && !descendants[row.pid] {
				descendants[row.pid], changed = true, true
			}
		}
	}
	var total int64
	for _, row := range rows {
		if descendants[row.pid] {
			total += row.rss
		}
	}
	return total
}
