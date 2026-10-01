package resolver

import (
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/model"
)

func TestDayRequiresSession(t *testing.T) {
	t.Parallel()
	_, err := (&queryResolver{New(Dependencies{})}).Day(t.Context(), model.DayInput{})
	assertErrorCode(t, err, "UNAUTHENTICATED")
}

func TestSelectedCalendarDateValidation(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 1, 12, 0, 0, 0, time.UTC)
	for _, value := range []string{"", "2026-02-30", "2000-01-01", "2040-01-01"} {
		_, err := selectedCalendarDate(value, now, time.UTC)
		assertErrorCode(t, err, "VALIDATION_FAILED")
	}
	date, err := selectedCalendarDate("2026-10-02", now, time.UTC)
	if err != nil || date.Format(time.RFC3339) != "2026-10-02T00:00:00Z" {
		t.Fatalf("date=%v err=%v", date, err)
	}
}
