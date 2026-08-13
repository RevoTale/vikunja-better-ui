package graphql

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/99designs/gqlgen/graphql"
	"github.com/RevoTale/vikunja-better-ui/internal/graphql/resolver"
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
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
