package service

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

type RecurrenceUnit string

const (
	RecurrenceUnitDay   RecurrenceUnit = "DAY"
	RecurrenceUnitWeek  RecurrenceUnit = "WEEK"
	RecurrenceUnitMonth RecurrenceUnit = "MONTH"
)

type RecurrenceMode string

const (
	RecurrenceModeFromCompletion RecurrenceMode = "FROM_COMPLETION"
	RecurrenceModeScheduled      RecurrenceMode = "SCHEDULED_CYCLE"
)

var ErrUnsupportedRecurrence = errors.New("vikunja cannot represent this recurrence combination")

type JobInput struct {
	Title                   string
	Description             string
	Priority                int64
	StartLocal              string
	DurationMinutes         int
	CompletionWindowMinutes int
}

type OneTimeInput struct {
	Title       string
	Description string
	Priority    int64
	DueDate     string
	DueTime     string
}

type RecurringInput struct {
	Title        string
	Description  string
	Priority     int64
	FirstDueDate string
	DueTime      string
	Interval     int
	Unit         RecurrenceUnit
	Mode         RecurrenceMode
}

type RecurrenceWrite struct {
	RepeatAfter int64
	RepeatMode  int
}

func BuildOneTimeTask(input OneTimeInput, location *time.Location) (vikunja.TaskWrite, bool, error) {
	base, err := baseTaskWrite(input.Title, input.Description, input.Priority)
	if err != nil {
		return vikunja.TaskWrite{}, false, err
	}
	due, dateOnly, err := resolveOptionalDue(input.DueDate, input.DueTime, location)
	if err != nil {
		return vikunja.TaskWrite{}, false, err
	}
	base.DueDate = due
	return base, dateOnly, nil
}

func BuildRecurringTask(input RecurringInput, location *time.Location) (vikunja.TaskWrite, bool, error) {
	if input.FirstDueDate == "" {
		return vikunja.TaskWrite{}, false, fmt.Errorf("first due date is required")
	}
	base, err := baseTaskWrite(input.Title, input.Description, input.Priority)
	if err != nil {
		return vikunja.TaskWrite{}, false, err
	}
	due, dateOnly, err := resolveOptionalDue(input.FirstDueDate, input.DueTime, location)
	if err != nil {
		return vikunja.TaskWrite{}, false, err
	}
	rule, err := BuildIntervalRecurrence(input.Interval, input.Unit, input.Mode)
	if err != nil {
		return vikunja.TaskWrite{}, false, err
	}
	base.DueDate = due
	base.RepeatAfter = rule.RepeatAfter
	base.RepeatMode = rule.RepeatMode
	return base, dateOnly, nil
}

func BuildJobTask(input JobInput, location *time.Location) (vikunja.TaskWrite, error) {
	if input.DurationMinutes <= 0 || input.CompletionWindowMinutes <= 0 {
		return vikunja.TaskWrite{}, fmt.Errorf("duration and completion window must be positive")
	}

	start, err := ResolveLocalDateTime(input.StartLocal, location)
	if err != nil {
		return vikunja.TaskWrite{}, err
	}
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Job " + start.In(location).Format("02-01-2006 - 15:04")
	}
	base, err := baseTaskWrite(title, input.Description, input.Priority)
	if err != nil {
		return vikunja.TaskWrite{}, err
	}
	end, err := addMinutes(start, input.DurationMinutes)
	if err != nil {
		return vikunja.TaskWrite{}, fmt.Errorf("duration is too large: %w", err)
	}
	due, err := addMinutes(end, input.CompletionWindowMinutes)
	if err != nil {
		return vikunja.TaskWrite{}, fmt.Errorf("completion window is too large: %w", err)
	}

	base.StartDate = &start
	base.EndDate = &end
	base.DueDate = &due
	return base, nil
}

func BuildIntervalRecurrence(interval int, unit RecurrenceUnit, mode RecurrenceMode) (RecurrenceWrite, error) {
	if interval <= 0 {
		return RecurrenceWrite{}, fmt.Errorf("recurrence interval must be positive")
	}
	if unit == RecurrenceUnitMonth {
		if interval != 1 || mode != RecurrenceModeScheduled {
			return RecurrenceWrite{}, ErrUnsupportedRecurrence
		}
		return RecurrenceWrite{RepeatAfter: 1, RepeatMode: 1}, nil
	}

	secondsPerUnit, err := recurrenceUnitSeconds(unit)
	if err != nil {
		return RecurrenceWrite{}, err
	}
	if int64(interval) > (math.MaxInt64/int64(time.Second))/secondsPerUnit {
		return RecurrenceWrite{}, fmt.Errorf("recurrence interval is too large")
	}

	repeatMode := 0
	switch mode {
	case RecurrenceModeScheduled:
	case RecurrenceModeFromCompletion:
		repeatMode = 2
	default:
		return RecurrenceWrite{}, fmt.Errorf("recurrence mode is invalid")
	}
	return RecurrenceWrite{RepeatAfter: int64(interval) * secondsPerUnit, RepeatMode: repeatMode}, nil
}

func recurrenceUnitSeconds(unit RecurrenceUnit) (int64, error) {
	switch unit {
	case RecurrenceUnitDay:
		return int64(24 * time.Hour / time.Second), nil
	case RecurrenceUnitWeek:
		return int64(7 * 24 * time.Hour / time.Second), nil
	case RecurrenceUnitMonth:
		return 0, fmt.Errorf("recurrence unit is invalid")
	}
	return 0, fmt.Errorf("recurrence unit is invalid")
}

func addMinutes(value time.Time, minutes int) (time.Time, error) {
	if int64(minutes) > math.MaxInt64/int64(time.Minute) {
		return time.Time{}, fmt.Errorf("minute value overflows a duration")
	}
	result := value.Add(time.Duration(minutes) * time.Minute)
	if result.Year() < 1 || result.Year() > 9999 || !result.After(value) {
		return time.Time{}, fmt.Errorf("resulting timestamp is outside the supported range")
	}
	return result, nil
}

func baseTaskWrite(title string, description string, priority int64) (vikunja.TaskWrite, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return vikunja.TaskWrite{}, fmt.Errorf("title is required")
	}
	return vikunja.TaskWrite{Title: title, Description: description, Priority: priority}, nil
}

func resolveOptionalDue(date string, clock string, location *time.Location) (*time.Time, bool, error) {
	if date == "" {
		if clock != "" {
			return nil, false, fmt.Errorf("due time requires a due date")
		}
		return nil, false, nil
	}
	if clock == "" {
		resolved, err := ResolveDateOnly(date, location)
		return timePointer(resolved, err, true)
	}
	resolved, err := ResolveLocalDateTime(date+"T"+clock, location)
	return timePointer(resolved, err, false)
}

func timePointer(value time.Time, err error, dateOnly bool) (*time.Time, bool, error) {
	if err != nil {
		return nil, false, err
	}
	return &value, dateOnly, nil
}
