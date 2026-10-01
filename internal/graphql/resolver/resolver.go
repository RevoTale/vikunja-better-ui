// Package resolver adapts GraphQL inputs and application workflows without storing server state.
package resolver

import (
	"context"
	"io"
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

type commentClient interface {
	TaskComment(context.Context, int64, int64) (vikunja.TaskComment, error)
	TaskComments(context.Context, int64, vikunja.CommentQuery) (vikunja.CommentPage, error)
	CreateTaskComment(context.Context, int64, vikunja.TaskCommentWrite) (vikunja.TaskComment, error)
	UpdateTaskComment(context.Context, int64, int64, vikunja.TaskCommentWrite) (vikunja.TaskComment, error)
	DeleteTaskComment(context.Context, int64, int64) error
}

type attachmentClient interface {
	TaskAttachments(context.Context, int64, int64) (vikunja.AttachmentPage, error)
	UploadTaskAttachment(context.Context, int64, string, io.Reader) (vikunja.TaskAttachment, error)
}

type avatarReader interface {
	Avatar(context.Context, string) (string, error)
}

type relationClient interface {
	TaskRelationState(context.Context, int64) (vikunja.TaskRelationState, error)
	TaskRelations(context.Context, int64) (map[vikunja.RelationKind][]vikunja.RelatedTask, error)
	CreateTaskRelation(context.Context, int64, int64, vikunja.RelationKind) error
	DeleteTaskRelation(context.Context, int64, int64, vikunja.RelationKind) error
}

type taskClient interface {
	taskReaderWriter
	labelClient
}

type taskReaderWriter interface {
	TasksPage(context.Context, vikunja.TaskQuery) (vikunja.TaskPage, error)
	Task(context.Context, int64) (vikunja.Task, vikunja.ResponseMetadata, error)
	CreateTask(context.Context, int64, vikunja.TaskWrite) (vikunja.Task, error)
	CreateTaskHTML(context.Context, int64, vikunja.TaskWrite) (vikunja.Task, error)
	PatchTask(context.Context, int64, vikunja.TaskPatch, string) (vikunja.Task, error)
	PatchTaskChecked(context.Context, int64, vikunja.TaskPatch, vikunja.TaskCheck) (vikunja.Task, error)
	DeleteTask(context.Context, int64) error
}

type labelClient interface {
	Labels(context.Context) ([]vikunja.Label, error)
	CreateLabel(context.Context, vikunja.LabelWrite) (vikunja.Label, error)
	AttachLabel(context.Context, int64, int64) error
	DetachLabel(context.Context, int64, int64) error
}

// Dependencies supplies the authenticated transports and stateless workflow services.
type Dependencies struct {
	Credentials     auth.Credentials
	Sessions        *auth.SessionManager
	Cookies         auth.SessionCookies
	Limiter         *auth.LoginLimiter
	Users           userReader
	Projects        projectReader
	Tasks           taskClient
	Comments        commentClient
	Attachments     attachmentClient
	Avatars         avatarReader
	Relations       relationClient
	ReferencePolicy service.TaskReferencePolicy
	Capabilities    *service.CapabilityManager
	Logger          *slog.Logger
	Now             func() time.Time
}

// Resolver wires GraphQL operations to application services.
type Resolver struct {
	credentials     auth.Credentials
	sessions        *auth.SessionManager
	cookies         auth.SessionCookies
	limiter         *auth.LoginLimiter
	users           userReader
	projects        projectReader
	tasks           taskClient
	comments        commentClient
	attachments     attachmentClient
	avatars         avatarReader
	relations       relationClient
	referencePolicy service.TaskReferencePolicy
	capabilities    *service.CapabilityManager
	logger          *slog.Logger
	now             func() time.Time
}

// New constructs a resolver with the supplied request dependencies.
func New(dependencies Dependencies) *Resolver {
	return &Resolver{
		credentials:     dependencies.Credentials,
		sessions:        dependencies.Sessions,
		cookies:         dependencies.Cookies,
		limiter:         dependencies.Limiter,
		users:           dependencies.Users,
		projects:        dependencies.Projects,
		tasks:           dependencies.Tasks,
		comments:        dependencies.Comments,
		attachments:     dependencies.Attachments,
		avatars:         dependencies.Avatars,
		relations:       dependencies.Relations,
		referencePolicy: dependencies.ReferencePolicy,
		capabilities:    dependencies.Capabilities,
		logger:          dependencies.Logger,
		now:             dependencies.Now,
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
