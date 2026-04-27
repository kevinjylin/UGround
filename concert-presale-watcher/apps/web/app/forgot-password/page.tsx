"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import AuthFrame from "../components/AuthFrame";
import ErrorBanner from "../components/ErrorBanner";
import styles from "../auth.module.css";

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
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || json.error || !json.ok) {
        throw new Error(json.error ?? "Could not request a reset link.");
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
      kicker="Password reset"
      title="Get back into your account."
      lead="Send yourself a reset link and return to your watchlist."
    >
      {submitted ? (
        <div className={styles.successBanner} role="status" aria-live="polite">
          If an account with that email exists, a reset link has been sent.
          Check your inbox and spam folder.
        </div>
      ) : (
        <form className={styles.stack} onSubmit={submit}>
          <label htmlFor="forgot-email" className="srOnly">
            Email
          </label>
          <input
            className={styles.field}
            id="forgot-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
          />
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={busy}
          >
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}

      {error ? (
        <ErrorBanner message={error} className={styles.errorBanner} />
      ) : null}

      <p className={styles.footnote}>
        Remembered it? <Link href="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}
