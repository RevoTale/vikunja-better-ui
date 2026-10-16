package vikunja

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strconv"
)

const minimumMajor = 2
const minimumMinor = 7

var stableVersion = regexp.MustCompile(`^v?([0-9]+)\.([0-9]+)\.[0-9]+(?:-[0-9]+-g[0-9a-f]+)?(?:\+[0-9A-Za-z.-]+)?$`)

// RequireSupportedVersion rejects unavailable, unknown, prerelease or pre-2.7 servers at startup.
func (client *Client) RequireSupportedVersion(ctx context.Context) error {
	var info struct {
		Version string `json:"version"`
	}
	if _, err := client.doJSON(ctx, http.MethodGet, "info", nil, "", &info); err != nil {
		return errors.New("cannot verify Vikunja version; Vikunja 2.7.0 or later is required")
	}
	parts := stableVersion.FindStringSubmatch(info.Version)
	if len(parts) == 0 {
		return errors.New("vikunja 2.7.0 or later is required; unsupported version format")
	}
	major, majorErr := strconv.Atoi(parts[1])
	minor, minorErr := strconv.Atoi(parts[2])
	if majorErr != nil || minorErr != nil || major < minimumMajor || (major == minimumMajor && minor < minimumMinor) {
		return errors.New("vikunja 2.7.0 or later is required")
	}
	return nil
}
