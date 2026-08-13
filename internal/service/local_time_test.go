package service

import (
	"testing"
	"time"
)

func TestResolveLocalDateTime(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	resolved, err := ResolveLocalDateTime("2026-08-12T09:30", location)
	if err != nil {
		t.Fatalf("ResolveLocalDateTime() error = %v", err)
	}
	if got := resolved.In(location).Format("2006-01-02T15:04"); got != "2026-08-12T09:30" {
		t.Fatalf("resolved local time = %q", got)
	}
}

func TestResolveLocalDateTimeRejectsDSTGapAndFold(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{"2026-03-08T02:30", "2026-11-01T01:30"} {
		if _, err := ResolveLocalDateTime(value, location); err == nil {
			t.Fatalf("ResolveLocalDateTime(%q) error = nil", value)
		}
	}
}

func TestResolveDateOnlyUsesFinalLocalSecond(t *testing.T) {
	t.Parallel()

	location, err := time.LoadLocation("Europe/Kyiv")
	if err != nil {
		t.Fatal(err)
	}
	resolved, err := ResolveDateOnly("2026-08-12", location)
	if err != nil {
		t.Fatalf("ResolveDateOnly() error = %v", err)
	}
	if got := resolved.In(location).Format("2006-01-02T15:04:05"); got != "2026-08-12T23:59:59" {
		t.Fatalf("resolved date-only = %q", got)
	}
}
