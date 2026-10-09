package resolver

import (
	"context"
	"testing"
)

func TestSessionReportsConfiguredClockWithoutUpstreamAccess(t *testing.T) {
	t.Parallel()

	for _, twelve := range []bool{false, true} {
		root := New(Dependencies{Use12HourTime: twelve})
		result, err := root.Query().Session(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if result.Use12HourTime != twelve {
			t.Fatal("session did not expose configured clock")
		}
	}
}
