"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import ErrorBanner from "../components/ErrorBanner";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const nextPath = new URLSearchParams(window.location.search).get("next");
      const result = await signIn("credentials", {
        username: identifier,
        password,
        redirect: false,
        callbackUrl:
          nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard",
      });

      if (result?.error) {
        throw new Error("Invalid email, username, or password");
      }

      router.replace(result?.url ?? "/dashboard");
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
    const nextPath = new URLSearchParams(window.location.search).get("next");

    await signIn("google", {
      callbackUrl:
        nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard",
    });
  };

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <span className="wordmark">UGround</span>
        <h1>Sign In</h1>
        <p className="helpText">
          Use email, username, or continue with Google.
        </p>
        <form className="stack" onSubmit={submit}>
          <label htmlFor="login-identifier" className="srOnly">
            Email or username
          </label>
          <input
            id="login-identifier"
            type="text"
            autoComplete="username"
            autoFocus
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Email or username"
            required
          />
          <label htmlFor="login-password" className="srOnly">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
          />
          <div className="authInlineLinks">
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <button
          type="button"
          className="btn--external"
          onClick={() => void signInWithGoogle()}
          disabled={googleBusy}
        >
          {googleBusy ? "Redirecting..." : "Continue with Google"}
        </button>
        {error ? <ErrorBanner message={error} /> : null}
        <p className="authFootnote">
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
