"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import AuthFrame from "../components/AuthFrame";
import ErrorBanner from "../components/ErrorBanner";
import styles from "../auth.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
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
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        username?: string;
      };

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
        throw new Error(
          "Account created, but automatic sign-in failed. Try signing in manually.",
        );
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
    <AuthFrame
      kicker="Create your watchlist"
      title="Start catching shows before they sell out."
      lead="Build a private watchlist and get alerts as soon as a date drops."
    >
      <form className={styles.stack} onSubmit={submit}>
        <label htmlFor="signup-username" className="srOnly">
          Username
        </label>
        <input
          className={styles.field}
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
        <label htmlFor="signup-email" className="srOnly">
          Email
        </label>
        <input
          className={styles.field}
          id="signup-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
        />
        <label htmlFor="signup-password" className="srOnly">
          Password
        </label>
        <input
          className={styles.field}
          id="signup-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          minLength={8}
          required
        />
        <button className={styles.primaryButton} type="submit" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className={styles.divider}>
        <span>or</span>
      </div>

      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => void signUpWithGoogle()}
        disabled={googleBusy}
      >
        {googleBusy ? "Redirecting..." : "Continue with Google"}
      </button>

      {error ? (
        <ErrorBanner message={error} className={styles.errorBanner} />
      ) : null}

      <p className={styles.footnote}>
        Already watching? <Link href="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}
