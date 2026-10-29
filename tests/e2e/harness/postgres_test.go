package main

import (
	"context"
	"encoding/binary"
	"io"
	"net"
	"testing"
	"time"
)

const readySession = "R\x00\x00\x00\x08\x00\x00\x00\x00Z\x00\x00\x00\x05I"

func TestPostgresHandshakeRequiresReadySession(t *testing.T) {
	t.Parallel()
	for _, scenario := range []struct {
		name, response string
		ready          bool
	}{
		{"ready", readySession, true},
		{"starting", "E\x00\x00\x00\x04", false},
		{"unauthenticated", "Z\x00\x00\x00\x05I", false},
		{"password", "R\x00\x00\x00\x08\x00\x00\x00\x03", false},
		{"oversized", "S\xff\xff\xff\xff", false},
		{"short", "S\x00\x00\x00\x03", false},
		{"incomplete", "R\x00", false},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			t.Parallel()
			client, server := net.Pipe()
			defer func() { _ = client.Close() }()
			go replyPostgres(t, server, scenario.response)
			if got := postgresHandshake(client); got != scenario.ready {
				t.Fatalf("ready=%v", got)
			}
		})
	}
}

func replyPostgres(t *testing.T, connection net.Conn, response string) {
	t.Helper()
	defer func() { _ = connection.Close() }()
	if err := connection.SetDeadline(time.Now().Add(time.Second)); err != nil {
		t.Error(err)
		return
	}
	var header [4]byte
	if _, err := io.ReadFull(connection, header[:]); err != nil {
		t.Error(err)
		return
	}
	length := binary.BigEndian.Uint32(header[:])
	const expected = "\x00\x03\x00\x00user\x00vikunja_test\x00database\x00vikunja_test\x00\x00"
	if length != uint32(len(expected)+4) {
		t.Errorf("startup length=%d", length)
		return
	}
	payload := make([]byte, len(expected))
	if _, err := io.ReadFull(connection, payload); err != nil {
		t.Error(err)
		return
	}
	if string(payload) != expected {
		t.Error("wrong fixture startup parameters")
		return
	}
	_, _ = io.WriteString(connection, response)
}

func TestPostgresReadinessRetriesStartupAndHonorsCancellation(t *testing.T) {
	t.Parallel()
	var config net.ListenConfig
	listener, err := config.Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		for _, response := range []string{"E\x00\x00\x00\x04", readySession} {
			connection, acceptErr := listener.Accept()
			if acceptErr != nil {
				t.Error(acceptErr)
				return
			}
			replyPostgres(t, connection, response)
		}
	}()
	if err = waitPostgres(t.Context(), listener.Addr().String()); err != nil {
		t.Fatal(err)
	}
	<-finished
	if err = listener.Close(); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err = waitPostgres(ctx, listener.Addr().String()); err == nil {
		t.Fatal("ignored cancellation")
	}
}
