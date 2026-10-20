package graphql

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/resolver"
	"github.com/RevoTale/vikunja-better-ui/internal/service"
)

func TestAllTimeActivityAnonymousBoundary(t *testing.T) {
	t.Parallel()
	root := resolver.New(resolver.Dependencies{
		PublicAllTimeActivityEnabled: true,
		AllTimeActivity: service.NewPublicAllTimeActivity(publicActivityReader{}, func() time.Time {
			return time.Date(2026, 10, 15, 13, 0, 0, 0, time.UTC)
		}),
	})
	handler := NewHandler(root, true, discardLogger())
	body := graphQLRequest(t, handler,
		`{ publicAllTimeActivity { total weeks { date count completedWithDeadline completedOnTime
        priorities { priority count completedWithDeadline completedOnTime } } } }`).Body.String()
	if !strings.Contains(body, `"total":2`) || !strings.Contains(body, `"date":"2026-10-12"`) ||
		!strings.Contains(body, `"priorities":[{"priority":`) || strings.Contains(body, "private-user") {
		t.Fatalf("unsafe/incorrect public result: %s", body)
	}
	for _, query := range []string{
		`{ publicAllTimeActivity(from: "2020-01-01") { total } }`,
		`{ publicAllTimeActivity { weeks { taskId } } }`,
		`{ a: publicAllTimeActivity { total } b: publicAllTimeActivity { total } }`,
	} {
		if body := graphQLRequest(t, handler, query).Body.String(); !strings.Contains(body, `"errors"`) {
			t.Fatalf("unsafe query accepted: %s", body)
		}
	}
	off := NewHandler(resolver.New(resolver.Dependencies{}), true, discardLogger())
	body = graphQLRequest(t, off, `{ publicAllTimeActivity { total } }`).Body.String()
	if !strings.Contains(body, `"publicAllTimeActivity":null`) {
		t.Fatalf("disabled feature exposed data: %s", body)
	}
}

func TestAllTimeActivityAllowsAuthenticatedAccessWhenPublicAccessIsDisabled(t *testing.T) {
	t.Parallel()
	root := resolver.New(resolver.Dependencies{
		PublicAllTimeActivityEnabled: false,
		AllTimeActivity: service.NewPublicAllTimeActivity(publicActivityReader{}, func() time.Time {
			return time.Date(2026, 10, 15, 13, 0, 0, 0, time.UTC)
		}),
	})
	if body := graphQLRequest(t, NewHandler(root, true, discardLogger()),
		`{ publicAllTimeActivity { total } }`).Body.String(); !strings.Contains(body, `"publicAllTimeActivity":null`) {
		t.Fatalf("anonymous response = %s", body)
	}
	body := authenticatedActivityRequest(t, root, `{ publicAllTimeActivity { total } }`).Body.String()
	if !strings.Contains(body, `"total":2`) {
		t.Fatalf("authenticated response = %s", body)
	}
}

func TestAllTimeActivityBrowserOperationFitsSafetyBudget(t *testing.T) {
	t.Parallel()
	operation, err := os.ReadFile("../../frontend/src/features/activity/activity.graphql")
	if err != nil {
		t.Fatal(err)
	}
	_, query, ok := strings.Cut(string(operation), "query PublicAllTimeActivity")
	if !ok {
		t.Fatal("missing browser operation")
	}
	root := resolver.New(resolver.Dependencies{
		PublicAllTimeActivityEnabled: true,
		AllTimeActivity: service.NewPublicAllTimeActivity(
			publicActivityReader{}, func() time.Time { return time.Date(2026, 10, 15, 13, 0, 0, 0, time.UTC) },
		),
	})
	// Apollo adds typename selections for cache identity, including nested buckets.
	query = strings.ReplaceAll(query, "{", "{ __typename ")
	body := graphQLRequest(t, NewHandler(root, true, discardLogger()), "query PublicAllTimeActivity"+query).Body.String()
	if strings.Contains(body, `"errors"`) {
		t.Fatalf("browser operation rejected: %s", body)
	}
}
