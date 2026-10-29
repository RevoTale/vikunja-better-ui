package main

import (
	_ "embed"
	"encoding/json"
	"time"
)

//go:embed fixtures.json
var fixtureDefinitions []byte

type fixtureTask struct {
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	Priority    int       `json:"priority"`
	StartDate   time.Time `json:"start_date,omitzero"`
	EndDate     time.Time `json:"end_date,omitzero"`
	DueDate     time.Time `json:"due_date,omitzero"`
	RepeatAfter int64     `json:"repeat_after,omitempty"`
	RepeatMode  int       `json:"repeat_mode,omitempty"`
	Done        bool      `json:"done,omitempty"`
	DoneAt      time.Time `json:"done_at,omitzero"`
}

type dateSpec struct {
	Kind      string `json:"kind"`
	Hour      int    `json:"hour"`
	Minute    int    `json:"minute"`
	DayOffset int    `json:"dayOffset"`
	Minutes   int    `json:"minutes"`
	Weekday   int    `json:"weekday"`
}

type taskSpec struct {
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Priority      int      `json:"priority"`
	Labels        []string `json:"labels"`
	HistoryLabels []string `json:"historyLabels"`
	History       struct {
		Hour     int `json:"hour"`
		Minute   int `json:"minute"`
		Duration int `json:"duration"`
	} `json:"history"`
	Active struct {
		StartDate   dateSpec `json:"start_date"`
		EndDate     dateSpec `json:"end_date"`
		DueDate     dateSpec `json:"due_date"`
		RepeatAfter int64    `json:"repeat_after"`
		RepeatMode  int      `json:"repeat_mode"`
	} `json:"active"`
}

type schedules struct {
	Schedule []taskSpec `json:"schedule"`
	Week     []taskSpec `json:"week"`
}

func readSchedules() (schedules, error) {
	var result schedules
	err := json.Unmarshal(fixtureDefinitions, &result)
	return result, err
}

func (spec dateSpec) at(now time.Time) time.Time {
	const daysPerWeek = 7
	if spec.Kind == "" {
		return time.Time{}
	}
	if spec.Kind == "after" {
		return now.Add(time.Duration(spec.Minutes) * time.Minute).UTC()
	}
	offset := spec.DayOffset
	if spec.Kind == "week" {
		today := (int(now.Weekday()) + daysPerWeek - 1) % daysPerWeek
		offset = spec.Weekday - today
	}
	return time.Date(now.Year(), now.Month(), now.Day()+offset, spec.Hour, spec.Minute, 0, 0, now.Location()).UTC()
}

func (spec taskSpec) active(now time.Time) fixtureTask {
	return fixtureTask{
		Title: spec.Title, Description: spec.Description, Priority: spec.Priority,
		StartDate: spec.Active.StartDate.at(now), EndDate: spec.Active.EndDate.at(now), DueDate: spec.Active.DueDate.at(now),
		RepeatAfter: spec.Active.RepeatAfter, RepeatMode: spec.Active.RepeatMode,
	}
}

func (spec taskSpec) history(now time.Time, offset int) fixtureTask {
	const minutesPerHour = 60
	date := dateSpec{Kind: "at", Hour: spec.History.Hour, Minute: spec.History.Minute, DayOffset: offset}
	task := fixtureTask{Title: spec.Title, Priority: spec.Priority, DueDate: date.at(now)}
	if spec.History.Duration != 0 {
		task.StartDate = task.DueDate
		date.Minute += spec.History.Duration
		task.EndDate = date.at(now)
		date.Minute += minutesPerHour
		task.DueDate = date.at(now)
	}
	return task
}
