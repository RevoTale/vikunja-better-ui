package integration

import (
	"time"
)

type errorResponse struct {
	Error apiError `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type jobsResponse struct {
	Items      []jobResponse `json:"items"`
	Page       int           `json:"page"`
	PageSize   int           `json:"pageSize"`
	TotalItems int64         `json:"totalItems"`
	TotalPages int64         `json:"totalPages"`
	HasMore    bool          `json:"hasMore"`
	IsComplete bool          `json:"isComplete"`
	Issues     []apiError    `json:"issues"`
}

type jobResponse struct {
	ID          string          `json:"id"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Project     projectResponse `json:"project"`
	Priority    string          `json:"priority"`
	DueAt       *time.Time      `json:"dueAt"`
	HasDueTime  bool            `json:"hasDueTime"`
	StartAt     *time.Time      `json:"startAt"`
	EndAt       *time.Time      `json:"endAt"`
	Labels      []labelResponse `json:"labels"`
	DoneAt      *time.Time      `json:"doneAt"`
	FinishAt    *time.Time      `json:"finishAt"`
	IsOverdue   bool            `json:"isOverdue"`
	Timezone    string          `json:"timezone"`
	URL         string          `json:"url"`
}

type projectResponse struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	IsDefault bool   `json:"isDefault"`
}

type labelResponse struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}
