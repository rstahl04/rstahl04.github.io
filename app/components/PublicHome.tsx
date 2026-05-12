"use client";

import { FormEvent, useState } from "react";

type AuthMode = "login" | "signup";

export function PublicHome() {
  const [mode, setMode] = useState<AuthMode>("signup");

  return (
    <main>
      <section className="publicHero">
        <div className="topBar">
          <div className="brand">
            <img className="brandLogo" src="/prompter-logo-clean.png" alt="Prompter" />
          </div>
          <div className="publicActions">
            <button type="button" onClick={() => setMode("login")}>
              Log in
            </button>
            <button type="button" className="dark" onClick={() => setMode("signup")}>
              Sign up
            </button>
          </div>
        </div>

        <div className="publicGrid">
          <div className="heroCopy">
            <p className="eyebrow">AI phone assistant setup</p>
            <h1>Build cleaner business prompts from real website facts.</h1>
            <p>
              Prompter.com turns a public business website into a structured prompt, welcome
              message, and knowledge base without guessing missing details.
            </p>
            <div className="priceCard">
              <strong>$4.99/month</strong>
              <span>7-day free trial after payment info is entered. Cancel anytime.</span>
            </div>
          </div>

          <AuthCard mode={mode} setMode={setMode} />
        </div>
      </section>

      <section className="publicDetails">
        <article>
          <h3>Website-aware outputs</h3>
          <p>Scrape public pages and generate organized sections that are easy to review and copy.</p>
        </article>
        <article>
          <h3>No guessing</h3>
          <p>Missing hours, pricing, policies, or booking rules are clearly marked for confirmation.</p>
        </article>
        <article>
          <h3>Team access</h3>
          <p>Owner and employee accounts can be granted free access separately from paid subscribers.</p>
        </article>
      </section>
    </main>
  );
}

function AuthCard({
  mode,
  setMode
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isSignup = mode === "signup";
  const canRequestCode = isSignup && email.trim().length > 0 && password.length >= 8;

  async function handleRequestCode() {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const responseText = await response.text();
      const payload = responseText ? safeParseJson(responseText) : {};

      if (!response.ok) {
        throw new Error(payload.error || "Unable to send verification code.");
      }

      setCodeSent(true);
      setDevCode(payload.devCode || "");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(isSignup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, verificationCode })
      });

      const responseText = await response.text();
      const payload = responseText ? safeParseJson(responseText) : {};

      if (!response.ok) {
        throw new Error(payload.error || "Something went wrong. Please try again.");
      }

      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      window.location.reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="authCard" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">{isSignup ? "Start your trial" : "Welcome back"}</p>
        <h2>{isSignup ? "Create your account." : "Log in."}</h2>
        <p>
          {isSignup
            ? "You will enter payment info in Stripe. Your first charge starts after 7 days."
            : "Use your owner, employee, or subscriber account."}
        </p>
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="text"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setCodeSent(false);
            setVerificationCode("");
            setDevCode("");
          }}
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
          onChange={(event) => {
            setPassword(event.target.value);
            setCodeSent(false);
            setVerificationCode("");
            setDevCode("");
          }}
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={8}
          required
        />
      </div>
      {canRequestCode ? (
        <div className="verificationBox">
          <button className="secondaryButton" type="button" onClick={handleRequestCode} disabled={isLoading}>
            {codeSent ? "Send new code" : "Send verification code"}
          </button>
          {codeSent ? <p>Enter the 6-digit code sent to your email.</p> : null}
          {devCode ? <p className="devCode">Local test code: {devCode}</p> : null}
        </div>
      ) : null}
      {isSignup && codeSent ? (
        <div className="field">
          <label htmlFor="verificationCode">Verification Code</label>
          <input
            id="verificationCode"
            type="text"
            inputMode="numeric"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            required
          />
        </div>
      ) : null}

      <button className="generateButton" type="submit" disabled={isLoading || (isSignup && (!codeSent || !verificationCode))}>
        {isLoading
          ? isSignup
            ? "Opening checkout..."
            : "Signing in..."
          : isSignup
            ? "Start 7-day trial"
            : "Log in"}
      </button>
      {error ? <p className="error">{error}</p> : null}

      <button className="textButton" type="button" onClick={() => setMode(isSignup ? "login" : "signup")}>
        {isSignup ? "Already have an account? Log in" : "Need an account? Start a trial"}
      </button>
    </form>
  );
}

function safeParseJson(value: string): { error?: string; checkoutUrl?: string; devCode?: string } {
  try {
    return JSON.parse(value) as { error?: string; checkoutUrl?: string };
  } catch {
    return {};
  }
}
