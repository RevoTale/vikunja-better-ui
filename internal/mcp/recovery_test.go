package mcp

import (
	"errors"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

func TestMCPRecoveryRejectsUICapabilitiesAndExpiredGrants(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 9, 12, 0, 0, 0, time.UTC)
	clock := func() time.Time { return now }
	fixture := testHandler(t, "http://127.0.0.1:1")
	handler, ok := fixture.(*handler)
	if !ok {
		t.Fatal("unexpected handler")
	}
	ui := service.NewCapabilityManager([]byte("fixture-mcp-secret-not-a-real-credential"), clock)
	grant := service.MarkerRepairGrant{TaskID: 1, MarkerTitles: []string{"vbu:job"}, ETag: "fixture"}
	capability, err := ui.IssueMarkerRepair("same-principal", grant)
	if err != nil {
		t.Fatal(err)
	}
	_, err = handler.capabilities.ParseMarkerRepair("same-principal", capability)
	if !errors.Is(err, service.ErrInvalidCapability) {
		t.Fatalf("UI capability accepted by MCP: %v", err)
	}
	mcp := service.NewCapabilityManager(handler.secret, clock)
	capability, err = mcp.IssueMarkerRepair("token-a", grant)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := mcp.ParseMarkerRepair("token-b", capability); !errors.Is(err, service.ErrInvalidCapability) {
		t.Fatalf("cross-principal repair accepted: %v", err)
	}
	now = now.Add(time.Hour)
	if _, err := mcp.ParseMarkerRepair("token-a", capability); !errors.Is(err, service.ErrExpiredCapability) {
		t.Fatalf("expired recovery accepted: %v", err)
	}
}
