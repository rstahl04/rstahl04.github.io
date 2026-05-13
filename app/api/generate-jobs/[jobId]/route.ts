import { NextResponse } from "next/server";
import { getSessionFromCookieHeader, hasAppAccess } from "@/lib/auth";
import { getGenerateJob } from "@/lib/generation-jobs";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = getSessionFromCookieHeader(request.headers.get("cookie"));

  if (!user || !hasAppAccess(user)) {
    return NextResponse.json({ error: "Please sign in to view generation jobs." }, { status: 401 });
  }

  const { jobId } = await params;
  const job = getGenerateJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Generation job was not found." }, { status: 404 });
  }

  return NextResponse.json({ job });
}
