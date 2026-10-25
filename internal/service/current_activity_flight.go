package service

import (
	"context"
	"sync"
)

type currentActivityCall[T any] struct {
	done  chan struct{}
	value T
	err   error
}

type currentActivityFlight[T any] struct {
	mutex  sync.Mutex
	active *currentActivityCall[T]
}

func (flight *currentActivityFlight[T]) read(ctx context.Context, load func() (T, error)) (T, error) {
	if err := ctx.Err(); err != nil {
		var zero T
		return zero, err
	}
	flight.mutex.Lock()
	call := flight.active
	if call == nil {
		call = &currentActivityCall[T]{done: make(chan struct{})}
		flight.active = call
		flight.mutex.Unlock()
		call.value, call.err = load()
		flight.mutex.Lock()
		flight.active = nil
		close(call.done)
		flight.mutex.Unlock()
		return call.value, call.err
	}
	flight.mutex.Unlock()
	select {
	case <-call.done:
		return call.value, call.err
	case <-ctx.Done():
		var zero T
		return zero, ctx.Err()
	}
}
