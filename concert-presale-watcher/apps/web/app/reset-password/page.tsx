"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import AuthFrame from "../components/AuthFrame";
import ErrorBanner from "../components/ErrorBanner";
import styles from "../auth.module.css";

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
        <div className={styles.successBanner} role="status" aria-live="polite">
          Your password has been reset.
        </div>
        <Link href="/login" className={styles.primaryLink}>
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <form className={styles.stack} onSubmit={submit}>
        <label htmlFor="reset-password" className="srOnly">
          New password
        </label>
        <input
          className={styles.field}
          id="reset-password"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          minLength={8}
          required
        />
        <label htmlFor="reset-confirm-password" className="srOnly">
          Confirm password
        </label>
        <input
          className={styles.field}
          id="reset-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          minLength={8}
          required
        />
        <button className={styles.primaryButton} type="submit" disabled={busy}>
          {busy ? "Resetting..." : "Reset password"}
        </button>
      </form>

      {error ? (
        <ErrorBanner message={error} className={styles.errorBanner} />
      ) : null}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthFrame
      kicker="New password"
      title="Choose a new password."
      lead="Finish the reset and sign in again when the link checks out."
    >
      <ResetPasswordForm />

      <p className={styles.footnote}>
        Back to <Link href="/login">sign in</Link>
      </p>
    </AuthFrame>
  );
}
