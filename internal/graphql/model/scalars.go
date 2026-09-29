// Package model defines GraphQL models and validated local-calendar scalars.
package model

import (
	"fmt"
	"io"
	"strconv"
	"time"
)

const (
	localDateLayout     = "2006-01-02"
	localTimeLayout     = "15:04"
	localDateTimeLayout = "2006-01-02T15:04"
)

// LocalDate is a calendar date without a timezone, formatted YYYY-MM-DD.
//
//nolint:recvcheck // gqlgen marshals scalar values but unmarshals through mutable pointers.
type LocalDate string

// UnmarshalGQL rejects values that are not valid calendar dates.
func (value *LocalDate) UnmarshalGQL(input any) error {
	parsed, err := unmarshalLocalScalar(input, localDateLayout, "LocalDate")
	if err != nil {
		return err
	}

	*value = LocalDate(parsed)
	return nil
}

// MarshalGQL writes the date as a quoted GraphQL string.
func (value LocalDate) MarshalGQL(writer io.Writer) {
	marshalLocalScalar(writer, string(value))
}

// LocalTime is a minute-precision wall-clock time, formatted HH:MM.
//
//nolint:recvcheck // gqlgen marshals scalar values but unmarshals through mutable pointers.
type LocalTime string

// UnmarshalGQL rejects invalid times and finer-than-minute precision.
func (value *LocalTime) UnmarshalGQL(input any) error {
	parsed, err := unmarshalLocalScalar(input, localTimeLayout, "LocalTime")
	if err != nil {
		return err
	}

	*value = LocalTime(parsed)
	return nil
}

// MarshalGQL writes the time as a quoted GraphQL string.
func (value LocalTime) MarshalGQL(writer io.Writer) {
	marshalLocalScalar(writer, string(value))
}

// LocalDateTime combines a calendar date and minute-precision time without an offset.
//
//nolint:recvcheck // gqlgen marshals scalar values but unmarshals through mutable pointers.
type LocalDateTime string

// UnmarshalGQL validates the date/time while rejecting timezone offsets.
func (value *LocalDateTime) UnmarshalGQL(input any) error {
	parsed, err := unmarshalLocalScalar(input, localDateTimeLayout, "LocalDateTime")
	if err != nil {
		return err
	}

	*value = LocalDateTime(parsed)
	return nil
}

// MarshalGQL writes the local date/time as a quoted GraphQL string.
func (value LocalDateTime) MarshalGQL(writer io.Writer) {
	marshalLocalScalar(writer, string(value))
}

func unmarshalLocalScalar(input any, layout string, name string) (string, error) {
	text, ok := input.(string)
	if !ok {
		return "", fmt.Errorf("%s must be a string", name)
	}

	if _, err := time.Parse(layout, text); err != nil {
		return "", fmt.Errorf("%s must use the required calendar format: %w", name, err)
	}

	return text, nil
}

func marshalLocalScalar(writer io.Writer, value string) {
	_, _ = io.WriteString(writer, strconv.Quote(value))
}
