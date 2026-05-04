"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import AuthFrame from "../components/AuthFrame";
import ErrorBanner from "../components/ErrorBanner";
import styles from "../auth.module.css";

const getSafeNextPath = (): string => {
  const nextPath = new URLSearchParams(window.location.search).get("next");
  return nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : "/dashboard";
};

const getAuthCallbackUrl = (nextPath: string): string => {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
};

export default function LoginPage() {
  const router = useRouter();
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
      const supabase = createSupabaseBrowserClient();
      const nextPath = getSafeNextPath();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        throw new Error("Invalid email or password");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setGoogleBusy(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const nextPath = getSafeNextPath();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthCallbackUrl(nextPath),
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
      kicker="Sign in"
      title="Welcome back."
      lead="Use your email or continue with Google."
    >
      <form className={styles.stack} onSubmit={submit}>
        <label htmlFor="login-email" className="srOnly">
          Email
        </label>
        <input
          className={styles.field}
          id="login-email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
        />
        <label htmlFor="login-password" className="srOnly">
          Password
        </label>
        <input
          className={styles.field}
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          required
        />
        <div className={styles.inlineLinks}>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <button className={styles.primaryButton} type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <button
        type="button"
        className={styles.googleButton}
        onClick={() => void signInWithGoogle()}
        disabled={googleBusy}
      >
        <svg
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          style={{ display: "block", width: "20px", height: "20px" }}
        >
          <g>
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            ></path>
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            ></path>
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            ></path>
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            ></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </g>
        </svg>
        {googleBusy ? "Redirecting..." : "Continue with Google"}
      </button>
      {error ? (
        <ErrorBanner message={error} className={styles.errorBanner} />
      ) : null}
      <p className={styles.footnote}>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </AuthFrame>
  );
}
