import { NextResponse } from "next/server";
import { getSessionFromCookieHeader, hasAppAccess } from "@/lib/auth";
import { buildGenerationInput } from "@/lib/prompts";
import { scrapeBusinessWebsite } from "@/lib/scraper";

export const runtime = "nodejs";
export const maxDuration = 60;

type GeneratedSections = {
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

const requiredKeys: (keyof GeneratedSections)[] = [
  "customizedPrompt",
  "welcomeMessage",
  "knowledgeBase",
  "businessInfoSummary",
  "servicesFound",
  "hoursFound",
  "bookingRules",
  "transferRules",
  "missingInfoToConfirm"
];

export async function POST(request: Request) {
  try {
    const user = getSessionFromCookieHeader(request.headers.get("cookie"));

    if (!user || !hasAppAccess(user)) {
      return NextResponse.json({ error: "Please sign in to generate prompts." }, { status: 401 });
    }

    const body = await request.json();
    const assistantType = body.assistantType === "chat" ? "chat" : "voice";
    const businessType = String(body.businessType ?? "").trim();
    const websiteUrl = String(body.websiteUrl ?? "").trim();
    const additionalNotes = String(body.additionalNotes ?? "").trim();

    if (!businessType || !websiteUrl) {
      return NextResponse.json({ error: "Business type and website URL are required." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set on the backend. Add it to .env.local and restart the server." },
        { status: 500 }
      );
    }

    const scraped = await scrapeBusinessWebsite(websiteUrl);
    const input = buildGenerationInput({
      assistantType,
      businessType,
      websiteUrl,
      additionalNotes,
      pages: scraped.pages
    });

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions:
          assistantType === "chat"
            ? "You generate factual AI chat assistant prompts and business knowledge bases. Follow accuracy rules strictly and output only valid JSON."
            : "You generate factual AI phone assistant prompts and business knowledge bases. Follow accuracy rules strictly and output only valid JSON.",
        input,
        max_output_tokens: 12000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return NextResponse.json(
        { error: `OpenAI request failed: ${errorText.slice(0, 500)}` },
        { status: 502 }
      );
    }

    const aiPayload = await aiResponse.json();
    const outputText = extractOutputText(aiPayload);
    const sections = parseSections(outputText);

    return NextResponse.json({
      sections,
      scraped: {
        pageCount: scraped.pages.length,
        pages: scraped.pages.map((page) => ({ title: page.title, url: page.url })),
        warnings: scraped.warnings
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}

function extractOutputText(payload: unknown) {
  const response = payload as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };

  if (response.output_text) return response.output_text;

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text)
    .join("\n");

  if (!text) {
    throw new Error("OpenAI response did not include text output.");
  }

  return text;
}

function parseSections(outputText: string): GeneratedSections {
  const jsonText = extractJsonObject(outputText);
  const parsed = JSON.parse(jsonText) as Partial<GeneratedSections>;

  for (const key of requiredKeys) {
    if (typeof parsed[key] !== "string") {
      throw new Error(`OpenAI output was missing "${key}".`);
    }
  }

  return parsed as GeneratedSections;
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);

  throw new Error("OpenAI output was not valid JSON.");
}
