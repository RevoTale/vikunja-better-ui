package resolver

import (
	"strings"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/graphql/generated"
)

func TestDomainSchemaHasDiscoverableDescriptions(t *testing.T) {
	t.Parallel()
	schema := generated.NewExecutableSchema(generated.Config{}).Schema()
	for name, definition := range schema.Types {
		if definition.BuiltIn || strings.HasPrefix(name, "__") {
			continue
		}
		if strings.TrimSpace(definition.Description) == "" {
			t.Errorf("domain type %s needs an introspectable semantic description", name)
		}
	}
	for _, root := range []string{"Query", "Mutation"} {
		for _, field := range schema.Types[root].Fields {
			if !strings.HasPrefix(field.Name, "__") && strings.TrimSpace(field.Description) == "" {
				t.Errorf("%s.%s needs purpose, constraints and effects in its description", root, field.Name)
			}
		}
	}
}
