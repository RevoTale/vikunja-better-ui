package service

import (
	"fmt"
	"math"
	"strings"
)

// RecurringFrequency describes normalized commitments, not exact future occurrences.
// Calendar averages and rounding match the recurring-rhythm UI policy.
func RecurringFrequency(interval int, unit RecurrenceUnit, period string) string {
	periodDays, unitDays := rhythmDays(period), rhythmDays(string(unit))
	if interval <= 0 || periodDays == 0 || unitDays == 0 {
		return "Frequency unavailable"
	}
	count := periodDays / (unitDays * float64(interval))
	name := strings.ToLower(period)
	if count < 1 {
		return "Less than once / " + name
	}
	const precision = 10
	rounded := math.Round(count*precision) / precision
	calendarConversion := (unit == RecurrenceUnitMonth) != (period == "MONTH" || period == "YEAR")
	const epsilon = 0.000001
	prefix := ""
	if calendarConversion || math.Abs(count-rounded) > epsilon {
		prefix = "≈ "
	}
	return fmt.Sprintf("%s%g× / %s", prefix, rounded, name)
}

func rhythmDays(unit string) float64 {
	const yearDays = 365.2425
	const monthsPerYear = 12
	const daysPerWeek = 7
	switch unit {
	case "DAY":
		return 1
	case "WEEK":
		return daysPerWeek
	case "MONTH":
		return yearDays / monthsPerYear
	case "YEAR":
		return yearDays
	default:
		return 0
	}
}
