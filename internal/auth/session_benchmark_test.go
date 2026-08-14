package auth

import (
	"bytes"
	"testing"
	"time"
)

var benchmarkSession Session

func BenchmarkSessionParse(b *testing.B) {
	now := time.Date(2026, time.August, 15, 12, 0, 0, 0, time.UTC)
	manager := NewSessionManager(
		[]byte("0123456789abcdef0123456789abcdef"),
		func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	token, _, err := manager.Issue()
	if err != nil {
		b.Fatal(err)
	}

	b.ReportAllocs()
	for b.Loop() {
		session, err := manager.Parse(token)
		if err != nil {
			b.Fatal(err)
		}
		benchmarkSession = session
	}
}
