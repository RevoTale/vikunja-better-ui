package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"testing"
	"time"
)

func TestMeasurementsPreserveStatusAndSampleShortCommands(t *testing.T) {
	for _, mode := range []string{"slow-failure", "short-success"} {
		t.Run(mode, func(t *testing.T) {
			checkMeasurement(t, mode)
		})
	}
}

func checkMeasurement(t *testing.T, mode string) {
	t.Helper()
	t.Setenv("MEASURE_CHILD", mode)
	var output bytes.Buffer
	code, err := measure(t.Context(), []string{os.Args[0], "-test.run=^TestMeasureChild$"}, io.Discard, &output)
	var metrics measurement
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(output.Bytes(), &metrics); err != nil {
		t.Fatal(err)
	}
	want := 0
	if mode == "slow-failure" {
		want = 3
	}
	if code != want || metrics.Code == nil || *metrics.Code != want {
		t.Fatalf("code=%d metrics=%+v", code, metrics)
	}
	if metrics.Samples == 0 || metrics.PeakTreeRSSMiB == nil || *metrics.PeakTreeRSSMiB <= 0 {
		t.Fatalf("missing process measurements: %+v", metrics)
	}
	if mode == "slow-failure" && metrics.Seconds < 0.6 {
		t.Fatal("incorrect elapsed duration")
	}
}

func TestMeasureChild(_ *testing.T) {
	switch os.Getenv("MEASURE_CHILD") {
	case "slow-failure":
		time.Sleep(600 * time.Millisecond)
		os.Exit(3)
	case "short-success":
		time.Sleep(20 * time.Millisecond)
		os.Exit(0)
	default:
		return
	}
}

func TestMeasurementMissingExecutable(t *testing.T) {
	t.Parallel()
	code, err := measure(t.Context(), []string{"/nonexistent-test-command"}, io.Discard, io.Discard)
	if code != 1 || err == nil {
		t.Fatal("missing executable did not fail")
	}
}

func TestTreeRSSIncludesNestedChildrenRegardlessOfOrder(t *testing.T) {
	t.Parallel()
	if got := treeRSS("3 2 40\n2 1 20\n1 9 10\n4 9 999\n", 1); got != 70 {
		t.Fatalf("tree RSS = %d", got)
	}
}
