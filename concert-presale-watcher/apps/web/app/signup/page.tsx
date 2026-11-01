"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import AuthFrame, { AuthDivider, AuthLink, GoogleIcon } from "../components/AuthFrame";
import ErrorBanner from "../components/ErrorBanner";

const getAuthCallbackUrl = (nextPath: string): string => {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
};

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: getAuthCallbackUrl("/dashboard"),
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setSubmitted(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signUpWithGoogle = async () => {
    setGoogleBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthCallbackUrl("/dashboard"),
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
      title="Create your account"
      description="Follow artists and get alerts for new shows, presales, and on-sales. Free while in beta."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      {submitted ? (
        <Alert role="status" aria-live="polite">
          <MailCheck />
          <AlertDescription className="text-foreground">
            Check your inbox for a link to finish creating your account.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={submit}>
          <FieldGroup className="gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="signup-email">Email</FieldLabel>
              <Input
                className="h-10"
                id="signup-email"
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
              <FieldLabel htmlFor="signup-password">Password</FieldLabel>
              <Input
                className="h-10"
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="signup-password-hint"
                minLength={8}
                required
              />
              <FieldDescription id="signup-password-hint" className="text-[13px] leading-5">
                At least 8 characters
              </FieldDescription>
            </Field>
            <Button className="h-10 w-full" type="submit" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </Button>
          </FieldGroup>
        </form>
      )}

      {!submitted ? (
        <>
          <AuthDivider />
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            onClick={() => void signUpWithGoogle()}
            disabled={googleBusy}
          >
            <GoogleIcon />
            {googleBusy ? "Redirecting…" : "Continue with Google"}
          </Button>
        </>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
    </AuthFrame>
  );
}
