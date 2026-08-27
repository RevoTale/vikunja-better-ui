package vikunja

import "time"

type UserSettings struct {
	Timezone         string `json:"timezone"`
	WeekStart        int    `json:"week_start"`
	DefaultProjectID int64  `json:"default_project_id"`
}

type User struct {
	ID       int64        `json:"id"`
	Username string       `json:"username"`
	Name     string       `json:"name"`
	Settings UserSettings `json:"settings"`
}

type Project struct {
	ID            int64  `json:"id"`
	Title         string `json:"title"`
	IsArchived    bool   `json:"is_archived"`
	MaxPermission *int   `json:"max_permission"`
}

type Label struct {
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	HexColor    string    `json:"hex_color"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
}

type LabelWrite struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	HexColor    string `json:"hex_color,omitempty"`
}

type Task struct {
	ID            int64     `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Done          bool      `json:"done"`
	DoneAt        time.Time `json:"done_at"`
	DueDate       time.Time `json:"due_date"`
	ProjectID     int64     `json:"project_id"`
	RepeatAfter   int64     `json:"repeat_after"`
	RepeatMode    int       `json:"repeat_mode"`
	Priority      int64     `json:"priority"`
	StartDate     time.Time `json:"start_date"`
	EndDate       time.Time `json:"end_date"`
	Labels        []Label   `json:"labels"`
	Created       time.Time `json:"created"`
	Updated       time.Time `json:"updated"`
	CreatedBy     User      `json:"created_by"`
	MaxPermission *int      `json:"max_permission"`
}

type TaskWrite struct {
	Title       string     `json:"title"`
	Description string     `json:"description,omitempty"`
	Done        bool       `json:"done,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	RepeatAfter int64      `json:"repeat_after,omitempty"`
	RepeatMode  int        `json:"repeat_mode,omitempty"`
	Priority    int64      `json:"priority,omitempty"`
	StartDate   *time.Time `json:"start_date,omitempty"`
	EndDate     *time.Time `json:"end_date,omitempty"`
}

type TaskPatch struct {
	Done        *bool      `json:"done,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	StartDate   *time.Time `json:"start_date,omitempty"`
	EndDate     *time.Time `json:"end_date,omitempty"`
	RepeatAfter *int64     `json:"repeat_after,omitempty"`
	RepeatMode  *int       `json:"repeat_mode,omitempty"`
}

type TaskCheck struct {
	Done        *bool
	DoneAt      *time.Time
	DueDate     *time.Time
	StartDate   *time.Time
	EndDate     *time.Time
	RepeatAfter *int64
	RepeatMode  *int
}

type TaskQuery struct {
	Page               int64
	PerPage            int64
	Search             string
	Filter             string
	FilterTimezone     string
	FilterIncludeNulls *bool
	SortBy             []string
	OrderBy            []string
}

type page[T any] struct {
	Items      []T   `json:"items"`
	Total      int64 `json:"total"`
	Page       int64 `json:"page"`
	PerPage    int64 `json:"per_page"`
	TotalPages int64 `json:"total_pages"`
}

type TaskPage = page[Task]

type labelTask struct {
	LabelID int64 `json:"label_id"`
}
