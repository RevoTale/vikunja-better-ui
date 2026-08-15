package resolver

import (
	"context"
	"log/slog"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

type userReader interface {
	CurrentUser(context.Context) (vikunja.User, error)
}

type projectReader interface {
	Projects(context.Context) ([]vikunja.Project, error)
}

type taskClient interface {
	TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error)
	Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error)
	CreateTask(context.Context, int64, vikunja.TaskWrite) (vikunja.Task, error)
	CreateTaskHTML(context.Context, int64, vikunja.TaskWrite) (vikunja.Task, error)
	PatchTask(context.Context, int64, vikunja.TaskPatch, string) (vikunja.Task, error)
	PatchTaskChecked(context.Context, int64, vikunja.TaskPatch, vikunja.TaskCheck) (vikunja.Task, error)
	DeleteTask(context.Context, int64) error
	Labels(context.Context) ([]vikunja.Label, error)
	CreateLabel(context.Context, vikunja.LabelWrite) (vikunja.Label, error)
	AttachLabel(context.Context, int64, int64) error
	DetachLabel(context.Context, int64, int64) error
}

type Dependencies struct {
	Credentials  auth.Credentials
	Sessions     *auth.SessionManager
	Cookies      auth.SessionCookies
	Limiter      *auth.LoginLimiter
	Users        userReader
	Projects     projectReader
	Tasks        taskClient
	Capabilities *service.CapabilityManager
	Logger       *slog.Logger
	Now          func() time.Time
}

type Resolver struct {
	credentials  auth.Credentials
	sessions     *auth.SessionManager
	cookies      auth.SessionCookies
	limiter      *auth.LoginLimiter
	users        userReader
	projects     projectReader
	tasks        taskClient
	capabilities *service.CapabilityManager
	logger       *slog.Logger
	now          func() time.Time
}

func New(dependencies Dependencies) *Resolver {
	return &Resolver{
		credentials:  dependencies.Credentials,
		sessions:     dependencies.Sessions,
		cookies:      dependencies.Cookies,
		limiter:      dependencies.Limiter,
		users:        dependencies.Users,
		projects:     dependencies.Projects,
		tasks:        dependencies.Tasks,
		capabilities: dependencies.Capabilities,
		logger:       dependencies.Logger,
		now:          dependencies.Now,
	}
}

func clientError(code string, message string) error {
	return &gqlerror.Error{Message: message, Extensions: map[string]any{"code": code}}
}

func (resolver *Resolver) logError(message string, err error) {
	if resolver.logger != nil {
		resolver.logger.Error(message, "cause", err)
	}
}
