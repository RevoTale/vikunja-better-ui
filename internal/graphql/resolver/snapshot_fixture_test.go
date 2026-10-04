package resolver

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func (*taskActionClientStub) TaskRelations(
	context.Context, int64,
) (map[vikunja.RelationKind][]vikunja.RelatedTask, error) {
	return nil, nil
}

func (*taskActionClientStub) CreateTaskRelation(context.Context, int64, int64, vikunja.RelationKind) error {
	return nil
}
