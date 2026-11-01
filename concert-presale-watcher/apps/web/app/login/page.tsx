"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import AuthFrame, { AuthDivider, AuthLink, GoogleIcon } from "../components/AuthFrame";
import ErrorBanner from "../components/ErrorBanner";

const getSafeNextPath = (): string => {
  const nextPath = new URLSearchParams(window.location.search).get("next");
  return nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : "/dashboard";
};

const getAuthCallbackUrl = (nextPath: string): string => {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const nextPath = getSafeNextPath();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        throw new Error("Invalid email or password");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setGoogleBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const nextPath = getSafeNextPath();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthCallbackUrl(nextPath),
        },
      });

      if (oauthError) {
        throw new Error("Could not start Google sign-in.");
      }
    } catch (caught) {
      setError((caught as Error).message);
      setGoogleBusy(false);
    }
  };

  return (
    <AuthFrame
      title="Sign in to UGround"
      description="Use your email or your Google account"
      footer={
        <>
          New here? <AuthLink href="/signup">Create an account</AuthLink>
        </>
      }
    >
      <form onSubmit={submit}>
        <FieldGroup className="gap-5">
          <Field className="gap-2">
            <FieldLabel htmlFor="login-email">Email</FieldLabel>
            <Input
              className="h-10"
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>
          <Field className="gap-2">
            <div className="flex items-center justify-between gap-4">
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <Link
                href="/forgot-password"
                className="rounded-sm text-[13px] leading-5 text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              className="h-10"
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Button className="h-10 w-full" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </FieldGroup>
      </form>
      <AuthDivider />
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full"
        onClick={() => void signInWithGoogle()}
        disabled={googleBusy}
      >
        <GoogleIcon />
        {googleBusy ? "Redirecting…" : "Continue with Google"}
      </Button>
      {error ? <ErrorBanner message={error} /> : null}
    </AuthFrame>
  );
}
