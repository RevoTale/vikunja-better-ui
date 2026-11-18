package auth

import (
	"strings"
	"testing"
)

func TestValidAPIToken(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		credential string
		valid      bool
	}{
		{"tk_fixture", true}, {"tk_" + strings.Repeat("a", maxAPITokenBytes-3), true},
		{"", false}, {"tk_", false}, {"password", false}, {"Bearer tk_fixture", false},
		{"eyJwt.header.signature", false}, {"tk_fixture\n", false},
		{"tk_abc\u0000", false}, {"tk_" + strings.Repeat("a", maxAPITokenBytes), false},
	} {
		if got := ValidAPIToken(tc.credential); got != tc.valid {
			t.Errorf("accepted = %v, want %v for input of length %d", got, tc.valid, len(tc.credential))
		}
	}
}
