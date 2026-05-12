import { NextResponse } from "next/server";
import { createEmailVerification } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";
import { findUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const existingUser = findUser(email);

    if (existingUser?.access === "free" || existingUser?.access === "active") {
      return NextResponse.json({ error: "This account already has access. Please log in." }, { status: 409 });
    }

    const verification = createEmailVerification(email);
    const emailResult = await sendVerificationEmail({ email, code: verification.code });

    return NextResponse.json({
      ok: true,
      expiresAt: verification.expiresAt,
      delivery: emailResult.sent ? "email" : "dev",
      devCode: emailResult.sent ? undefined : verification.code
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send verification code." },
      { status: 500 }
    );
  }
}
