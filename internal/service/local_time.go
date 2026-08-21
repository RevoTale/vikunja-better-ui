package service

import (
	"errors"
	"fmt"
	"time"
)

const (
	localDateLayout       = "2006-01-02"
	localDateTimeLayout   = "2006-01-02T15:04"
	localDateSecondLayout = "2006-01-02T15:04:05"
)

var (
	ErrAmbiguousLocalTime   = errors.New("local time is ambiguous because of a timezone transition")
	ErrNonexistentLocalTime = errors.New("local time does not exist because of a timezone transition")
)

func ResolveLocalDateTime(value string, location *time.Location) (time.Time, error) {
	return resolveLocalWallTime(value, localDateTimeLayout, location)
}

func ResolveDateOnly(value string, location *time.Location) (time.Time, error) {
	if _, err := time.Parse(localDateLayout, value); err != nil {
		return time.Time{}, fmt.Errorf("date must use YYYY-MM-DD: %w", err)
	}
	return resolveLocalWallTime(value+"T23:59:59", localDateSecondLayout, location)
}

func resolveLocalWallTime(value string, layout string, location *time.Location) (time.Time, error) {
	if location == nil {
		return time.Time{}, errors.New("timezone is required")
	}
	wallTime, err := time.Parse(layout, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("local time has an invalid format: %w", err)
	}

	candidates := localTimeCandidates(wallTime, value, layout, location)
	switch len(candidates) {
	case 0:
		return time.Time{}, ErrNonexistentLocalTime
	case 1:
		return candidates[0], nil
	default:
		return time.Time{}, ErrAmbiguousLocalTime
	}
}

func localTimeCandidates(wallTime time.Time, value string, layout string, location *time.Location) []time.Time {
	offsets := make(map[int]struct{})
	for hour := -72; hour <= 72; hour += 6 {
		_, offset := wallTime.Add(time.Duration(hour) * time.Hour).In(location).Zone()
		offsets[offset] = struct{}{}
	}

	candidates := make([]time.Time, 0, len(offsets))
	seen := make(map[int64]struct{}, len(offsets))
	for offset := range offsets {
		candidate := wallTime.Add(-time.Duration(offset) * time.Second).In(location)
		if candidate.Format(layout) != value {
			continue
		}
		unixNano := candidate.UnixNano()
		if _, exists := seen[unixNano]; exists {
			continue
		}
		seen[unixNano] = struct{}{}
		candidates = append(candidates, candidate)
	}
	return candidates
}
