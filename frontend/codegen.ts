import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../internal/graphql/schema/*.graphqls",
  documents: ["src/**/*.graphql"],
  ignoreNoDocuments: false,
  generates: {
    "src/graphql/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        strictScalars: true,
        useTypeImports: true,
        scalars: {
          DateTime: "string",
          LocalDate: "string",
          LocalTime: "string",
          LocalDateTime: "string",
        },
      },
    },
  },
};

export default config;
