package concurrent

type Future[T any] struct {
	done  chan struct{}
	value T
	err   error
}

func Start[T any](call func() (T, error)) *Future[T] {
	result := &Future[T]{done: make(chan struct{})}
	go func() {
		result.value, result.err = call()
		close(result.done)
	}()
	return result
}

func (future *Future[T]) Wait() (T, error) {
	<-future.done
	return future.value, future.err
}
