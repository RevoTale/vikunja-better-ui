import { useMutation } from "@apollo/client/react";
import { type FormEvent, useState } from "react";

import { AppInput } from "@/components/app-input";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { LoginDocument } from "@/graphql/graphql";
import { graphQLErrorMessage } from "@/lib/user-error";
import { finishSessionChange } from "./session-change";

type LoginPageProps = {
  returnTo: string;
};

export function LoginPage({ returnTo }: LoginPageProps) {
  const [error, setError] = useState("");
  const [login, { loading }] = useMutation(LoginDocument, { fetchPolicy: "no-cache" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const token = String(new FormData(form).get("token") ?? "").trim();
    if (!token) {
      setError("Enter your Vikunja API token.");
      return;
    }

    try {
      const result = await login({ variables: { input: { token } } });
      const session = result.data?.login.session;
      if (!session?.authenticated) {
        setError("Login could not be confirmed.");
        return;
      }
      form.reset();
      finishSessionChange(returnTo);
    } catch (caught) {
      setError(graphQLErrorMessage(caught, "Sign-in failed. Check your connection and try again."));
    }
  }

  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <BrandMark className="size-10" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Better Vikunja
            </p>
          </div>
          <CardTitle>
            <h1>Better daily tasks</h1>
          </CardTitle>
          <CardDescription>Use a token from Settings → API Tokens in Vikunja.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit} noValidate>
            <Field>
              <FieldLabel htmlFor="token">Vikunja API token</FieldLabel>
              <AppInput
                id="token"
                name="token"
                type="password"
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={error ? "login-error" : undefined}
                disabled={loading}
                required
              />
            </Field>
            <Button type="submit" className="min-h-11" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <div className="min-h-10" id="login-error">
              {error ? <FieldError>{error}</FieldError> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
