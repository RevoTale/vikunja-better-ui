import { ApolloLink } from "@apollo/client";
import { print } from "graphql";
import { Observable } from "rxjs";

// Narrow multipart transport for our single-file mutation, not a generic object
// walker. The ordinary HttpLink continues to handle every other operation.
export const uploadLink = new ApolloLink((operation, forward) => {
  if (operation.operationName !== "UploadDiscussionMedia") return forward(operation);
  const input = operation.variables["input"];
  if (!input || !(input.file instanceof File)) return forward(operation);
  return new Observable((observer) => {
    const controller = new AbortController();
    const body = new FormData();
    body.append(
      "operations",
      JSON.stringify({
        query: print(operation.query),
        operationName: operation.operationName,
        variables: { ...operation.variables, input: { ...input, file: null } },
      }),
    );
    body.append("map", JSON.stringify({ file: ["variables.input.file"] }));
    body.append("file", input.file);
    const headers = new Headers(operation.getContext()["headers"]);
    headers.delete("content-type");
    void fetch("/graphql", {
      method: "POST",
      credentials: "same-origin",
      headers,
      body,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Upload response ${response.status}`);
        observer.next(await response.json());
        observer.complete();
      })
      .catch((error: unknown) => observer.error(error));
    return () => controller.abort();
  });
});
