import { buildGenerationInput } from "@/lib/prompts";
import { scrapeBusinessWebsite } from "@/lib/scraper";
import type { AssistantType, GeneratedSections, GenerateResponse } from "./generation-types";

type GenerationParams = {
  assistantType: AssistantType;
  businessType: string;
  websiteUrl: string;
  additionalNotes: string;
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

export async function generatePromptPackage(
  params: GenerationParams,
  onProgress?: (status: "scraping" | "generating", message: string) => void
): Promise<GenerateResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set on the backend. Add it to .env.local and restart the server.");
  }

  onProgress?.("scraping", "Scraping public website pages");
  const scraped = await scrapeBusinessWebsite(params.websiteUrl);
  const input = buildGenerationInput({
    assistantType: params.assistantType,
    businessType: params.businessType,
    websiteUrl: params.websiteUrl,
    additionalNotes: params.additionalNotes,
    pages: scraped.pages
  });

  onProgress?.("generating", "Generating prompt and knowledge base");
  const aiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions:
        params.assistantType === "chat"
          ? "You generate factual AI chat assistant prompts and business knowledge bases. Follow accuracy rules strictly, preserve the requested prompt structure, and output only valid JSON."
          : "You generate factual AI phone assistant prompts and business knowledge bases. Follow accuracy rules strictly, preserve the requested prompt structure, and output only valid JSON.",
      input,
      max_output_tokens: 12000
    })
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    throw new Error(`OpenAI request failed: ${errorText.slice(0, 500)}`);
  }

  const aiPayload = await aiResponse.json();
  const outputText = extractOutputText(aiPayload);
  const sections = parseSections(outputText);

  return {
    sections,
    scraped: {
      pageCount: scraped.pages.length,
      pages: scraped.pages.map((page) => ({ title: page.title, url: page.url })),
      warnings: scraped.warnings
    }
  };
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
