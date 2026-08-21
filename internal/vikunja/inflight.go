package vikunja

import (
	"context"
	"sync"
)

type inflightGroup[T any] struct {
	mutex sync.Mutex
	call  *inflightCall[T]
}

type inflightCall[T any] struct {
	done    chan struct{}
	cancel  context.CancelFunc
	waiters int
	value   T
	err     error
}

func (group *inflightGroup[T]) do(ctx context.Context, read func(context.Context) (T, error)) (T, error) {
	operation := group.join(ctx, read)
	select {
	case <-ctx.Done():
		group.leave(operation)
		var zero T
		return zero, ctx.Err()
	case <-operation.done:
		group.leave(operation)
		return operation.value, operation.err
	}
}

func (group *inflightGroup[T]) join(ctx context.Context, read func(context.Context) (T, error)) *inflightCall[T] {
	group.mutex.Lock()
	defer group.mutex.Unlock()

	if group.call == nil {
		sharedContext, cancel := context.WithCancel(context.WithoutCancel(ctx))
		group.call = &inflightCall[T]{done: make(chan struct{}), cancel: cancel}
		go func(operation *inflightCall[T]) {
			defer cancel()
			group.run(operation, sharedContext, read)
		}(group.call)
	}
	group.call.waiters++
	return group.call
}

func (group *inflightGroup[T]) run(
	operation *inflightCall[T],
	ctx context.Context,
	read func(context.Context) (T, error),
) {
	operation.value, operation.err = read(ctx)

	group.mutex.Lock()
	if group.call == operation {
		group.call = nil
	}
	group.mutex.Unlock()
	close(operation.done)
}

func (group *inflightGroup[T]) leave(operation *inflightCall[T]) {
	group.mutex.Lock()
	defer group.mutex.Unlock()

	operation.waiters--
	if operation.waiters == 0 {
		if group.call == operation {
			group.call = nil
		}
		operation.cancel()
	}
}
