package auth

import (
	"bytes"
	"testing"
	"time"
)

func BenchmarkSessionParse(b *testing.B) {
	now := time.Date(2026, time.August, 15, 12, 0, 0, 0, time.UTC)
	manager, err := NewSessionManager(
		[]byte("0123456789abcdef0123456789abcdef"), testUpstream,
		func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	if err != nil {
		b.Fatal(err)
	}
	token, _, err := manager.Issue("tk_test", "http://app.test")
	if err != nil {
		b.Fatal(err)
	}

	b.ReportAllocs()
	for b.Loop() {
		_, err := manager.Parse(token, "http://app.test")
		if err != nil {
			b.Fatal(err)
		}
	}
}
