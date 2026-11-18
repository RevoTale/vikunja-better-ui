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
        observer.next(await uploadResult(response));
        observer.complete();
      })
      .catch((error: unknown) => observer.error(error));
    return () => controller.abort();
  });
});

// The Go multipart boundary can reject the request before GraphQL runs.
const boundaryRejections: Record<number, { code: string; message: string }> = {
  401: { code: "UNAUTHENTICATED", message: "Sign in to upload this file." },
  403: { code: "FORBIDDEN", message: "Upload was refused. Refresh the page and try again." },
  411: {
    code: "VALIDATION_FAILED",
    message: "The server requires the file size to accept this upload.",
  },
  413: {
    code: "VALIDATION_FAILED",
    message: "This file exceeds the server’s upload limit. Choose a smaller file.",
  },
  415: {
    code: "VALIDATION_FAILED",
    message: "The server did not accept the upload request format.",
  },
};

async function uploadResult(response: Response): Promise<ApolloLink.Result> {
  if (response.ok) return response.json();
  const rejection = boundaryRejections[response.status];
  if (!rejection) throw new Error(`Upload response ${response.status}`);
  return { errors: [{ message: rejection.message, extensions: { code: rejection.code } }] };
}
