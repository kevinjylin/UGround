"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import ErrorBanner from "../components/ErrorBanner";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "Invalid reset link.",
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid reset link.");
      return;
    }

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
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || json.error || !json.ok) {
        throw new Error(json.error ?? "Could not reset your password.");
      }

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
        <div className="successBanner" role="status" aria-live="polite">
          Your password has been reset.
        </div>
        <Link href="/login" className="authPrimaryLink">
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <form className="stack" onSubmit={submit}>
        <label htmlFor="reset-password" className="srOnly">
          New password
        </label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          minLength={8}
          disabled={!token}
          required
        />
        <label htmlFor="reset-confirm-password" className="srOnly">
          Confirm password
        </label>
        <input
          id="reset-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          minLength={8}
          disabled={!token}
          required
        />
        <button type="submit" disabled={busy || !token}>
          {busy ? "Resetting..." : "Reset password"}
        </button>
      </form>

      {error ? <ErrorBanner message={error} /> : null}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="authShell">
      <section className="authPanel">
        <div>
          <Link href="/" className="wordmark authWordmark">
            UGround
          </Link>
          <p className="authKicker">New password</p>
          <h1>Choose a new password.</h1>
        </div>

        <Suspense fallback={<p className="helpText">Loading reset link...</p>}>
          <ResetPasswordForm />
        </Suspense>

        <p className="authFootnote">
          Back to <Link href="/login">sign in</Link>
        </p>
      </section>
    </main>
  );
}
