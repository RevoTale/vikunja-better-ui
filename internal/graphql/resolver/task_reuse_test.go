package resolver

import (
	"testing"
	"time"
)

func TestTaskReuseRequiresSession(t *testing.T) {
	r := &queryResolver{Resolver: &Resolver{}}
	if _, err := r.TaskReuseValues(t.Context(), false, false); err == nil {
		t.Fatal("accepted unauthenticated query")
	}
}

func TestReuseMinutes(t *testing.T) {
	start := time.Date(2026, 9, 29, 8, 0, 0, 0, time.UTC)
	for _, delta := range []time.Duration{-time.Minute, 0, time.Second} {
		if reuseMinutes(start, start.Add(delta)) != nil {
			t.Fatal("accepted invalid duration")
		}
	}
	if reuseMinutes(time.Time{}, start) != nil {
		t.Fatal("accepted missing start")
	}
	if got := reuseMinutes(start, start.Add(4*time.Hour)); got == nil || *got != 240 {
		t.Fatalf("got %v", got)
	}
}
