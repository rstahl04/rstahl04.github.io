import { NextResponse } from "next/server";
import { getSessionFromCookieHeader, hasAppAccess } from "@/lib/auth";
import { createGenerateJob, updateGenerateJob } from "@/lib/generation-jobs";
import { generatePromptPackage } from "@/lib/generation-service";

export const runtime = "nodejs";
export const maxDuration = 300;

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

    const job = createGenerateJob();

    void processJob(job.id, {
      assistantType,
      businessType,
      websiteUrl,
      additionalNotes
    });

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start generation job." },
      { status: 500 }
    );
  }
}

async function processJob(
  jobId: string,
  params: {
    assistantType: "voice" | "chat";
    businessType: string;
    websiteUrl: string;
    additionalNotes: string;
  }
) {
  try {
    const result = await generatePromptPackage(params, (status, message) => {
      updateGenerateJob(jobId, { status, message });
    });

    updateGenerateJob(jobId, {
      status: "completed",
      message: "Generation complete",
      result
    });
  } catch (error) {
    updateGenerateJob(jobId, {
      status: "failed",
      message: "Generation failed",
      error: error instanceof Error ? error.message : "Unexpected generation error."
    });
  }
}
