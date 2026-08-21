package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/RevoTale/vikunja-better-ui/internal/auth"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/resolver"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestOperationDepthCountsFieldsAndFragments(t *testing.T) {
	t.Parallel()

	document := &ast.QueryDocument{
		Operations: ast.OperationList{{
			SelectionSet: ast.SelectionSet{&ast.Field{Name: "one", SelectionSet: ast.SelectionSet{
				&ast.FragmentSpread{Name: "details"},
			}}},
		}},
		Fragments: ast.FragmentDefinitionList{{
			Name: "details", SelectionSet: ast.SelectionSet{&ast.Field{Name: "two", SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "three"},
			}}},
		}},
	}
	operation := &graphql.OperationContext{Doc: document, Operation: document.Operations[0]}
	if got := operationDepth(operation); got != 3 {
		t.Fatalf("operationDepth() = %d, want 3", got)
	}
}

func TestProductionHandlerBlocksAnonymousIntrospection(t *testing.T) {
	t.Parallel()

	handler := NewHandler(resolver.New(resolver.Dependencies{}), true, discardLogger())
	response := graphQLRequest(t, handler, `{ __schema { queryType { name } } }`)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "introspection") {
		t.Fatalf("response = %d %q", response.Code, response.Body.String())
	}
}

func TestHandlerAppliesComplexityLimit(t *testing.T) {
	t.Parallel()

	fields := make([]string, maxOperationComplexity+1)
	for index := range fields {
		fields[index] = "s" + strconv.Itoa(index) + ": session { authenticated }"
	}
	handler := NewHandler(resolver.New(resolver.Dependencies{}), false, discardLogger())
	response := graphQLRequest(t, handler, "{ "+strings.Join(fields, " ")+" }")
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "COMPLEXITY_LIMIT_EXCEEDED") {
		t.Fatalf("response = %d %q", response.Code, response.Body.String())
	}
}

func TestSessionWithoutVikunjaUserDoesNotReadUpstream(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.August, 21, 12, 0, 0, 0, time.UTC)
	sessions := auth.NewSessionManager(
		[]byte("01234567890123456789012345678901"),
		func() time.Time { return now },
		bytes.NewReader([]byte("0123456789abcdef")),
	)
	token, _, err := sessions.Issue()
	if err != nil {
		t.Fatal(err)
	}
	reader := &countingUserReader{}
	server := NewHandler(resolver.New(resolver.Dependencies{
		Sessions: sessions,
		Users:    reader,
	}), false, discardLogger())
	handler := auth.HTTPContext(sessions, auth.NewSessionCookies(false))(server)

	body, err := json.Marshal(map[string]string{
		"query": `query AuthSession { session { authenticated csrfToken expiresAt } }`,
	})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(
		t.Context(), http.MethodPost, "http://app.test/graphql", bytes.NewReader(body),
	)
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(&http.Cookie{
		Name: "vbu_session", Value: token, HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"authenticated":true`) {
		t.Fatalf("response = %d %q", recorder.Code, recorder.Body.String())
	}
	if calls := reader.calls.Load(); calls != 0 {
		t.Fatalf("CurrentUser() calls = %d, want 0", calls)
	}
}

type countingUserReader struct {
	calls atomic.Int32
}

func (reader *countingUserReader) CurrentUser(context.Context) (vikunja.User, error) {
	reader.calls.Add(1)
	return vikunja.User{ID: 1, Username: "user"}, nil
}

func graphQLRequest(t *testing.T, handler http.Handler, query string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]string{"query": query})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "http://app.test/graphql", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}
