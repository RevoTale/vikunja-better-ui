package auth

import (
	"errors"
	"testing"
)

func TestCredentialsVerify(t *testing.T) {
	t.Parallel()

	credentials := NewCredentials("configured-user", "configured-password")
	tests := []struct {
		name     string
		username string
		password string
		wantErr  bool
	}{
		{name: "matching credentials", username: "configured-user", password: "configured-password"},
		{name: "wrong username", username: "other-user", password: "configured-password", wantErr: true},
		{name: "wrong password", username: "configured-user", password: "other-password", wantErr: true},
		{name: "both wrong", username: "other-user", password: "other-password", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			err := credentials.Verify(test.username, test.password)
			if test.wantErr {
				if !errors.Is(err, ErrInvalidCredentials) {
					t.Fatalf("Verify() error = %v, want ErrInvalidCredentials", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("Verify() error = %v", err)
			}
		})
	}
}
