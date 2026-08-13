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

type LocalDate string

func (value *LocalDate) UnmarshalGQL(input any) error {
	parsed, err := unmarshalLocalScalar(input, localDateLayout, "LocalDate")
	if err != nil {
		return err
	}

	*value = LocalDate(parsed)
	return nil
}

func (value LocalDate) MarshalGQL(writer io.Writer) {
	marshalLocalScalar(writer, string(value))
}

type LocalTime string

func (value *LocalTime) UnmarshalGQL(input any) error {
	parsed, err := unmarshalLocalScalar(input, localTimeLayout, "LocalTime")
	if err != nil {
		return err
	}

	*value = LocalTime(parsed)
	return nil
}

func (value LocalTime) MarshalGQL(writer io.Writer) {
	marshalLocalScalar(writer, string(value))
}

type LocalDateTime string

func (value *LocalDateTime) UnmarshalGQL(input any) error {
	parsed, err := unmarshalLocalScalar(input, localDateTimeLayout, "LocalDateTime")
	if err != nil {
		return err
	}

	*value = LocalDateTime(parsed)
	return nil
}

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
