"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import ErrorBanner from "../components/ErrorBanner";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; username?: string };

      if (!res.ok || json.error || !json.ok) {
        throw new Error(json.error ?? "Could not create your account.");
      }

      const result = await signIn("credentials", {
        username: json.username ?? username,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        throw new Error("Account created, but automatic sign-in failed. Try signing in manually.");
      }

      router.replace(result?.url ?? "/dashboard");
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signUpWithGoogle = async () => {
    setGoogleBusy(true);
    setError(null);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <main className="authShell">
      <section className="authPanel">
        <div>
          <Link href="/" className="wordmark authWordmark">
            UGround
          </Link>
          <p className="authKicker">Create your watchlist</p>
          <h1>Start catching shows before they sell out.</h1>
        </div>

        <form className="stack" onSubmit={submit}>
          <label htmlFor="signup-username" className="srOnly">
            Username
          </label>
          <input
            id="signup-username"
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            minLength={3}
            maxLength={40}
            required
          />
          <label htmlFor="signup-password" className="srOnly">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            minLength={8}
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="authDivider">
          <span>or</span>
        </div>

        <button type="button" className="btn--external" onClick={() => void signUpWithGoogle()} disabled={googleBusy}>
          {googleBusy ? "Redirecting..." : "Continue with Google"}
        </button>

        {error ? <ErrorBanner message={error} /> : null}

        <p className="authFootnote">
          Already watching? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
