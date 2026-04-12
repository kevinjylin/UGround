"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import ErrorBanner from "../components/ErrorBanner";

export default function LoginPage() {
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
      const nextPath = new URLSearchParams(window.location.search).get("next");
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl: nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard",
      });

      if (result?.error) {
        throw new Error("Invalid username or password");
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
      callbackUrl: nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard",
    });
  };

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <span className="wordmark">UGround</span>
        <h1>Sign In</h1>
        <p className="helpText">Use username/password or continue with Google.</p>
        <form className="stack" onSubmit={submit}>
          <label htmlFor="login-username" className="srOnly">Username</label>
          <input
            id="login-username"
            type="text"
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            required
          />
          <label htmlFor="login-password" className="srOnly">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <button type="button" className="btn--external" onClick={() => void signInWithGoogle()} disabled={googleBusy}>
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
