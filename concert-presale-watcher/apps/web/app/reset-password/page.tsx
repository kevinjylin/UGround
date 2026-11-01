"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import AuthFrame, { AuthLink } from "../components/AuthFrame";
import ErrorBanner from "../components/ErrorBanner";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw new Error(
          "Reset link expired or invalid. Request a new password reset link.",
        );
      }

      await supabase.auth.signOut();
      setComplete(true);
      setPassword("");
      setConfirmPassword("");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (complete) {
    return (
      <>
        <Alert role="status" aria-live="polite">
          <CircleCheck />
          <AlertDescription className="text-foreground">Your password has been reset.</AlertDescription>
        </Alert>
        <Button asChild className="h-10 w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <form onSubmit={submit}>
        <FieldGroup className="gap-5">
          <Field className="gap-2">
            <FieldLabel htmlFor="reset-password">New password</FieldLabel>
            <Input
              className="h-10"
              id="reset-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="reset-password-hint"
              minLength={8}
              required
            />
            <FieldDescription id="reset-password-hint" className="text-[13px] leading-5">
              At least 8 characters
            </FieldDescription>
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="reset-confirm-password">Confirm new password</FieldLabel>
            <Input
              className="h-10"
              id="reset-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </Field>
          <Button className="h-10 w-full" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </Button>
        </FieldGroup>
      </form>

      {error ? <ErrorBanner message={error} /> : null}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthFrame
      title="Choose a new password"
      description="You'll use it the next time you sign in."
      footer={
        <>
          Back to <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <ResetPasswordForm />
    </AuthFrame>
  );
}
