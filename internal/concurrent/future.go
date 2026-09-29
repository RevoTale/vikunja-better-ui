// Package concurrent joins independent request-scoped reads without caching their results.
package concurrent

// Future holds one asynchronous result; Wait may be called more than once.
type Future[T any] struct {
	done  chan struct{}
	value T
	err   error
}

// Start runs call once. The caller owns cancellation through the closure's context.
func Start[T any](call func() (T, error)) *Future[T] {
	result := &Future[T]{done: make(chan struct{})}
	go func() {
		result.value, result.err = call()
		close(result.done)
	}()
	return result
}

// Wait blocks until the call finishes and returns its value and error.
func (future *Future[T]) Wait() (T, error) {
	<-future.done
	return future.value, future.err
}
