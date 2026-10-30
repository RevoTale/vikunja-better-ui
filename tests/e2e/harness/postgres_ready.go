package main

import (
	"context"
	"encoding/binary"
	"io"
	"net"
	"time"
)

// TCP acceptance precedes recovery completion. Require a usable fixture session.
func postgresSessionReady(ctx context.Context, address string) bool {
	dialer := net.Dialer{Timeout: time.Second}
	connection, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return false
	}
	defer func() { _ = connection.Close() }()
	if err = connection.SetDeadline(time.Now().Add(time.Second)); err != nil {
		return false
	}
	return postgresHandshake(connection)
}

func postgresHandshake(connection net.Conn) bool {
	const startup = "\x00\x03\x00\x00user\x00vikunja_test\x00database\x00vikunja_test\x00\x00"
	const lengthBytes = 4
	packet := binary.BigEndian.AppendUint32(nil, uint32(len(startup)+lengthBytes))
	if _, err := connection.Write(append(packet, startup...)); err != nil {
		return false
	}
	authenticated := false
	for {
		var header [5]byte
		if _, err := io.ReadFull(connection, header[:]); err != nil {
			return false
		}
		length := binary.BigEndian.Uint32(header[1:])
		const maxMessage = 4096
		if length < lengthBytes || length > maxMessage || header[0] == 'E' {
			return false
		}
		payload := make([]byte, length-lengthBytes)
		if _, err := io.ReadFull(connection, payload); err != nil {
			return false
		}
		switch header[0] {
		case 'R':
			if len(payload) != lengthBytes || binary.BigEndian.Uint32(payload) != 0 {
				return false
			}
			authenticated = true
		case 'Z':
			return authenticated && len(payload) == 1 && payload[0] == 'I'
		}
	}
}
