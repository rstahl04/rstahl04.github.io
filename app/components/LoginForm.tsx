"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const responseText = await response.text();
      const payload = responseText ? safeParseJson(responseText) : {};

      if (!response.ok) {
        throw new Error(payload.error || "Unable to sign in. Please try again.");
      }

      window.location.reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <section className="loginShell">
        <div className="loginIntro">
          <div className="brand">
            <span className="brandMark" aria-hidden="true">P</span>
            <span>Prompter.com</span>
          </div>
          <div>
            <p className="eyebrow">Private workspace</p>
            <h1>Sign in to generate business prompts.</h1>
            <p>
              Access is limited to active users, employees, and admins. Subscription billing can
              plug into this access check later.
            </p>
          </div>
        </div>

        <form className="loginForm" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="text"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="generateButton" type="submit" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

function safeParseJson(value: string): { error?: string } {
  try {
    return JSON.parse(value) as { error?: string };
  } catch {
    return {};
  }
}
