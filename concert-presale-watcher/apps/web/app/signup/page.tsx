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
        className={styles.googleButton}
        onClick={() => void signUpWithGoogle()}
        disabled={googleBusy}
      >
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{display: 'block', width: '20px', height: '20px'}}>
          <g>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </g>
        </svg>
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
