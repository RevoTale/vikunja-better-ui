package auth

import "regexp"

// This limit leaves room in a 4 KiB cookie for encryption, base64 and session metadata.
const maxAPITokenBytes = 2048

var apiTokenPattern = regexp.MustCompile(`^tk_[A-Za-z0-9._~+/-]+=*$`)

// ValidAPIToken checks the Vikunja API token prefix and HTTP Bearer credential alphabet.
// A successful upstream profile lookup establishes the token owner's identity.
func ValidAPIToken(token string) bool {
	return len(token) <= maxAPITokenBytes && apiTokenPattern.MatchString(token)
}
