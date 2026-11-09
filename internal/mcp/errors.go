package mcp

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func uncertainWrite(action string, err error) error {
	if errors.Is(err, service.ErrTaskStateChanged) || errors.Is(err, vikunja.ErrConditionFailed) {
		return errorsForTool("CONFLICT: reload the task and reconsider the requested change.")
	}
	var upstream *vikunja.Error
	if errors.As(err, &upstream) &&
		(upstream.Status == http.StatusUnauthorized || upstream.Status == http.StatusForbidden) {
		return fmt.Errorf("%s was denied by Vikunja. Check token permissions; earlier steps may have succeeded", action)
	}
	return fmt.Errorf("%s was not confirmed. Read current state before retrying; earlier steps may have succeeded", action)
}
