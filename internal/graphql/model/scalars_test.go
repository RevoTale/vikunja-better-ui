package model

import (
	"bytes"
	"testing"
)

func TestLocalDateUnmarshalGQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		value   any
		want    LocalDate
		wantErr bool
	}{
		{name: "valid", value: "2026-08-12", want: "2026-08-12"},
		{name: "invalid calendar date", value: "2026-02-30", wantErr: true},
		{name: "timestamp is not a date", value: "2026-08-12T10:30", wantErr: true},
		{name: "non string", value: 20260812, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			var got LocalDate
			err := got.UnmarshalGQL(test.value)
			if test.wantErr {
				if err == nil {
					t.Fatal("UnmarshalGQL() error = nil, want error")
				}
				return
			}

			if err != nil {
				t.Fatalf("UnmarshalGQL() error = %v", err)
			}
			if got != test.want {
				t.Fatalf("UnmarshalGQL() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestLocalTimeUnmarshalGQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		value   any
		want    LocalTime
		wantErr bool
	}{
		{name: "valid", value: "09:05", want: "09:05"},
		{name: "seconds are rejected", value: "09:05:00", wantErr: true},
		{name: "invalid hour", value: "24:00", wantErr: true},
		{name: "non string", value: 905, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			var got LocalTime
			err := got.UnmarshalGQL(test.value)
			if test.wantErr {
				if err == nil {
					t.Fatal("UnmarshalGQL() error = nil, want error")
				}
				return
			}

			if err != nil {
				t.Fatalf("UnmarshalGQL() error = %v", err)
			}
			if got != test.want {
				t.Fatalf("UnmarshalGQL() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestLocalDateTimeUnmarshalGQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		value   any
		want    LocalDateTime
		wantErr bool
	}{
		{name: "valid", value: "2026-08-12T09:05", want: "2026-08-12T09:05"},
		{name: "timezone is rejected", value: "2026-08-12T09:05Z", wantErr: true},
		{name: "invalid date", value: "2026-02-30T09:05", wantErr: true},
		{name: "non string", value: 202608120905, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			var got LocalDateTime
			err := got.UnmarshalGQL(test.value)
			if test.wantErr {
				if err == nil {
					t.Fatal("UnmarshalGQL() error = nil, want error")
				}
				return
			}

			if err != nil {
				t.Fatalf("UnmarshalGQL() error = %v", err)
			}
			if got != test.want {
				t.Fatalf("UnmarshalGQL() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestLocalScalarsMarshalGQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		marshal func(*bytes.Buffer)
		want    string
	}{
		{
			name: "date",
			marshal: func(buffer *bytes.Buffer) {
				LocalDate("2026-08-12").MarshalGQL(buffer)
			},
			want: `"2026-08-12"`,
		},
		{
			name: "time",
			marshal: func(buffer *bytes.Buffer) {
				LocalTime("09:05").MarshalGQL(buffer)
			},
			want: `"09:05"`,
		},
		{
			name: "date time",
			marshal: func(buffer *bytes.Buffer) {
				LocalDateTime("2026-08-12T09:05").MarshalGQL(buffer)
			},
			want: `"2026-08-12T09:05"`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			var buffer bytes.Buffer
			test.marshal(&buffer)
			if got := buffer.String(); got != test.want {
				t.Fatalf("MarshalGQL() = %q, want %q", got, test.want)
			}
		})
	}
}
