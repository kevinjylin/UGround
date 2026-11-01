"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import AuthFrame, { AuthLink } from "../components/AuthFrame";
import ErrorBanner from "../components/ErrorBanner";

const getResetCallbackUrl = (): string => {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", "/reset-password");
  return callbackUrl.toString();
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: getResetCallbackUrl(),
        },
      );

      if (resetError) {
        throw new Error("Could not request a reset link.");
      }

      setSubmitted(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title="Reset your password"
      description="Enter the email you signed up with and we'll send a reset link."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      {submitted ? (
        <Alert role="status" aria-live="polite">
          <MailCheck />
          <AlertDescription className="text-foreground">
            If an account with that email exists, a reset link is on its way. Check your inbox and
            spam folder.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={submit}>
          <FieldGroup className="gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
              <Input
                className="h-10"
                id="forgot-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </Field>
            <Button className="h-10 w-full" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </FieldGroup>
        </form>
      )}

      {error ? <ErrorBanner message={error} /> : null}
    </AuthFrame>
  );
}
