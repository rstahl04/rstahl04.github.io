"use client";

import { FormEvent, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/auth";

type AssistantType = "voice" | "chat";

type OutputSections = {
  customizedPrompt: string;
  welcomeMessage: string;
  knowledgeBase: string;
  businessInfoSummary: string;
  servicesFound: string;
  hoursFound: string;
  bookingRules: string;
  transferRules: string;
  missingInfoToConfirm: string;
};

type GenerateResponse = {
  sections: OutputSections;
  scraped: {
    pageCount: number;
    pages: { title: string; url: string }[];
    warnings: string[];
  };
};

type GenerateJob = {
  id: string;
  status: "queued" | "scraping" | "generating" | "completed" | "failed";
  message: string;
  result?: GenerateResponse;
  error?: string;
};

const sectionLabels: Record<keyof OutputSections, string> = {
  customizedPrompt: "Customized AI Prompt",
  welcomeMessage: "Welcome Message",
  knowledgeBase: "Knowledge Base",
  businessInfoSummary: "Business Info Summary",
  servicesFound: "Services Found",
  hoursFound: "Hours Found",
  bookingRules: "Booking Rules",
  transferRules: "Transfer Rules",
  missingInfoToConfirm: "Missing Info to Confirm"
};

const sectionOrder = Object.keys(sectionLabels) as (keyof OutputSections)[];
const useBackgroundJobs = process.env.NEXT_PUBLIC_BACKGROUND_JOBS_ENABLED === "true";

export function GeneratorApp({ user }: { user: SessionUser }) {
  const [assistantType, setAssistantType] = useState<AssistantType>("voice");
  const [businessType, setBusinessType] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState("");
  const [jobMessage, setJobMessage] = useState("");

  const allOutput = useMemo(() => {
    if (!result) return "";

    return sectionOrder
      .map((key) => `# ${sectionLabels[key]}\n\n${result.sections[key]}`)
      .join("\n\n---\n\n");
  }, [result]);

  async function copyText(label: string, text: string) {
    try {
      await copyToClipboard(text);
      setCopied(label);
      setError("");
      window.setTimeout(() => setCopied(""), 1600);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to copy text.");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  async function handleManageBilling() {
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const payload = (await response.json()) as { portalUrl?: string; error?: string };

    if (payload.portalUrl) {
      window.location.href = payload.portalUrl;
      return;
    }

    setError(payload.error || "Billing portal is not available for this account.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setJobMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(useBackgroundJobs ? "/api/generate-jobs" : "/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantType, businessType, websiteUrl, additionalNotes })
      });

      const responseText = await response.text();
      const payload = parseJsonResponse<(GenerateResponse & { error?: string }) | { job?: GenerateJob; error?: string }>(
        responseText
      );

      if (!response.ok) {
        throw new Error(payload?.error || responseText || "Unable to generate output.");
      }

      if (useBackgroundJobs) {
        const jobPayload = payload as { job?: GenerateJob };
        if (!jobPayload.job?.id) {
          throw new Error("The server response was missing a generation job.");
        }

        await pollGenerateJob(jobPayload.job.id);
        return;
      }

      const directPayload = payload as GenerateResponse | null;
      if (!directPayload?.sections) {
        throw new Error("The server response was missing generated sections.");
      }

      setResult(directPayload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  async function pollGenerateJob(jobId: string) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await fetch(`/api/generate-jobs/${jobId}`, { cache: "no-store" });
      const responseText = await response.text();
      const payload = parseJsonResponse<{ job?: GenerateJob; error?: string }>(responseText);

      if (!response.ok) {
        throw new Error(payload?.error || responseText || "Unable to check generation job.");
      }

      const job = payload?.job;
      if (!job) throw new Error("Generation job response was missing.");

      setJobMessage(job.message);

      if (job.status === "completed") {
        if (!job.result) throw new Error("Generation finished without a result.");
        setResult(job.result);
        setJobMessage("");
        return;
      }

      if (job.status === "failed") {
        throw new Error(job.error || "Generation failed.");
      }

      await wait(2000);
    }

    throw new Error("Generation is taking longer than expected. Please try again in a moment.");
  }

  return (
    <main>
      <section className="hero">
        <div className="topBar">
          <div className="brand">
            <img className="brandLogo" src="/prompter-logo-clean.png" alt="Prompter" />
          </div>
          <div className="accountBar">
            <span>{user.email}</span>
            {user.access === "active" ? (
              <button type="button" onClick={handleManageBilling}>
                Billing
              </button>
            ) : null}
            <button type="button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
        <div className="heroCopy">
          <p className="eyebrow">AI phone assistant setup</p>
          <h1>Build cleaner business prompts from real website facts.</h1>
          <p>
            Turn a public business site into a structured prompt, welcome message, and knowledge
            base without guessing missing details.
          </p>
        </div>
        <img className="heroPreview" src="/app-preview.svg" alt="" aria-hidden="true" />
      </section>

      <section className="workspace">
        <form className="generatorForm" onSubmit={handleSubmit}>
          <div className="field">
            <label>Assistant Type</label>
            <div className="segmentedControl" role="radiogroup" aria-label="Assistant type">
              <button
                type="button"
                className={assistantType === "voice" ? "active" : ""}
                onClick={() => setAssistantType("voice")}
                role="radio"
                aria-checked={assistantType === "voice"}
              >
                Voice Assistant
              </button>
              <button
                type="button"
                className={assistantType === "chat" ? "active" : ""}
                onClick={() => setAssistantType("chat")}
                role="radio"
                aria-checked={assistantType === "chat"}
              >
                Chat Assistant
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="businessType">Business Type</label>
            <input
              id="businessType"
              value={businessType}
              onChange={(event) => setBusinessType(event.target.value)}
              placeholder="Dental office, med spa, HVAC company..."
              required
            />
          </div>

          <div className="field">
            <label htmlFor="websiteUrl">Business Website URL</label>
            <input
              id="websiteUrl"
              type="url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="additionalNotes">Additional Notes</label>
            <textarea
              id="additionalNotes"
              value={additionalNotes}
              onChange={(event) => setAdditionalNotes(event.target.value)}
              placeholder="Only book Monday-Friday. Transfer emergency calls. Do not mention pricing unless listed."
              rows={6}
            />
          </div>

          <button className="generateButton" type="submit" disabled={isLoading}>
            {isLoading ? "Generating..." : "Generate Prompt + Knowledge Base"}
          </button>

          {jobMessage ? <p className="jobStatus">{jobMessage}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </form>

        <div className="outputArea">
          {!result ? (
            <div className="emptyState">
              <p className="eyebrow">Output</p>
              <h2>Your generated sections will appear here.</h2>
              <p>
                Each section gets its own copy button, plus one master copy button for the full
                generated package.
              </p>
            </div>
          ) : (
            <>
              <div className="resultHeader">
                <div>
                  <p className="eyebrow">Generated output</p>
                  <h2>Ready to review and copy.</h2>
                  <p>
                    Scraped {result.scraped.pageCount} public page
                    {result.scraped.pageCount === 1 ? "" : "s"}.
                  </p>
                </div>
                <button className="copyAllButton" onClick={() => copyText("Everything", allOutput)}>
                  {copied === "Everything" ? "Copied" : "Copy Everything"}
                </button>
              </div>

              {result.scraped.warnings.length > 0 ? (
                <div className="warnings">
                  {result.scraped.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <details className="sources">
                <summary>Public pages used</summary>
                <ul>
                  {result.scraped.pages.map((page) => (
                    <li key={page.url}>
                      <a href={page.url} target="_blank" rel="noreferrer">
                        {page.title || page.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>

              <div className="sections">
                {sectionOrder.map((key) => (
                  <section className="outputSection" key={key}>
                    <div className="sectionTitle">
                      <h3>{sectionLabels[key]}</h3>
                      <button onClick={() => copyText(sectionLabels[key], result.sections[key])}>
                        {copied === sectionLabels[key] ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre>{result.sections[key]}</pre>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function parseJsonResponse<T>(value: string): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browsers that expose Clipboard API but block the call.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Copy is not available in this browser.");
  }
}
