"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import ErrorBanner from "../components/ErrorBanner";

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
    <main className="authShell">
      <section className="authPanel">
        <div>
          <Link href="/" className="wordmark authWordmark">
            UGround
          </Link>
          <p className="authKicker">Password reset</p>
          <h1>Get back into your account.</h1>
        </div>

        {submitted ? (
          <div className="successBanner" role="status" aria-live="polite">
            If an account with that email exists, a reset link has been sent.
            Check your inbox and spam folder.
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label htmlFor="forgot-email" className="srOnly">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        {error ? <ErrorBanner message={error} /> : null}

        <p className="authFootnote">
          Remembered it? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
