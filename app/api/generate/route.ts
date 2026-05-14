import { NextResponse } from "next/server";
import { getSessionFromCookieHeader, hasAppAccess } from "@/lib/auth";
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

    const result = await generatePromptPackage({
      assistantType,
      businessType,
      websiteUrl,
      additionalNotes
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}
