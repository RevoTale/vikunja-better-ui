package vikunja

import "time"

// Native Vikunja recurrence modes are stable wire values.
const (
	RepeatModeScheduled      = 0
	RepeatModeMonthly        = 1
	RepeatModeFromCompletion = 2
)

// UserSettings contains scheduling preferences owned by the Vikunja user.
type UserSettings struct {
	Timezone         string `json:"timezone"`
	WeekStart        int    `json:"week_start"`
	DefaultProjectID int64  `json:"default_project_id"`
}

// User identifies an upstream user and their scheduling preferences.
type User struct {
	ID       int64        `json:"id"`
	Username string       `json:"username"`
	Name     string       `json:"name"`
	Settings UserSettings `json:"settings"`
}

// Project is an accessible upstream project with optional effective permissions.
type Project struct {
	ID            int64  `json:"id"`
	Title         string `json:"title"`
	IsArchived    bool   `json:"is_archived"`
	MaxPermission *int   `json:"max_permission"`
}

// Label is an upstream tag; its ID, not its title, identifies it uniquely.
type Label struct {
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	HexColor    string    `json:"hex_color"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
}

// LabelWrite contains fields accepted when creating an upstream label.
type LabelWrite struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	HexColor    string `json:"hex_color,omitempty"`
}

// Task preserves upstream scheduling, recurrence, ownership, and permission fields.
type Task struct {
	CommentCount  *int64    `json:"comment_count,omitempty"`
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

// TaskComment is the comment representation returned by Vikunja.
// Comment may contain the HTML produced by the Vikunja rich-text editor.
type TaskComment struct {
	ID      int64     `json:"id"`
	Comment string    `json:"comment"`
	TaskID  int64     `json:"task_id"`
	Author  *User     `json:"author"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

// TaskCommentWrite carries the comment HTML accepted by Vikunja.
type TaskCommentWrite struct {
	Comment string `json:"comment"`
}

// CommentQuery selects a bounded, ordered page of task comments.
type CommentQuery struct {
	Page    int64
	PerPage int64
	Order   string
}

// CommentPage includes comment items and upstream pagination metadata.
type CommentPage = page[TaskComment]

// TaskWrite contains task creation fields; absent timestamps retain upstream defaults.
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

// TaskPatch distinguishes omitted fields from explicit zero-value replacements.
type TaskPatch struct {
	Title       *string    `json:"title,omitempty"`
	Description *string    `json:"description,omitempty"`
	ProjectID   *int64     `json:"project_id,omitempty"`
	Priority    *int64     `json:"priority,omitempty"`
	Done        *bool      `json:"done,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	StartDate   *time.Time `json:"start_date,omitempty"`
	EndDate     *time.Time `json:"end_date,omitempty"`
	RepeatAfter *int64     `json:"repeat_after,omitempty"`
	RepeatMode  *int       `json:"repeat_mode,omitempty"`
}

// TaskCheck supplies expected values for atomic JSON Patch preconditions.
type TaskCheck struct {
	Updated     *time.Time
	Title       *string
	Description *string
	ProjectID   *int64
	Priority    *int64
	Done        *bool
	DoneAt      *time.Time
	DueDate     *time.Time
	StartDate   *time.Time
	EndDate     *time.Time
	RepeatAfter *int64
	RepeatMode  *int
}

// TaskQuery specifies upstream filtering, sorting, pagination, and optional expansions.
type TaskQuery struct {
	IncludeCommentCount bool
	Page                int64
	PerPage             int64
	Search              string
	Filter              string
	FilterTimezone      string
	FilterIncludeNulls  *bool
	SortBy              []string
	OrderBy             []string
}

type page[T any] struct {
	Items      []T   `json:"items"`
	Total      int64 `json:"total"`
	Page       int64 `json:"page"`
	PerPage    int64 `json:"per_page"`
	TotalPages int64 `json:"total_pages"`
}

// TaskPage includes task items and upstream pagination metadata.
type TaskPage = page[Task]

type labelTask struct {
	LabelID int64 `json:"label_id"`
}
