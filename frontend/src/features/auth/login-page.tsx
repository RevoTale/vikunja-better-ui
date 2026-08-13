import { useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoginDocument, SessionDocument } from "@/graphql/graphql";
import { setCSRFToken } from "@/lib/apollo";

type LoginPageProps = {
  returnTo: string;
};

export function LoginPage({ returnTo }: LoginPageProps) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [login, { loading }] = useMutation(LoginDocument, {
    update(cache, result) {
      const session = result.data?.login.session;
      if (session) {
        cache.writeQuery({ query: SessionDocument, data: { session } });
      }
    },
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!username || !password) {
      setError("Enter both your username and password.");
      return;
    }

    try {
      const result = await login({ variables: { input: { username, password } } });
      const session = result.data?.login.session;
      if (!session?.authenticated) {
        setError("Login could not be confirmed.");
        return;
      }
      setCSRFToken(session.csrfToken);
      await navigate({ href: returnTo, replace: true });
    } catch {
      setError("The username or password is incorrect.");
    }
  }

  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Vikunja
          </p>
          <CardTitle>Better daily tasks</CardTitle>
          <CardDescription>Sign in with the credentials configured for this app.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit} noValidate>
            {error ? (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3"
                role="alert"
              >
                <FieldError>{error}</FieldError>
              </div>
            ) : null}
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                disabled={loading}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                disabled={loading}
                required
              />
            </Field>
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
