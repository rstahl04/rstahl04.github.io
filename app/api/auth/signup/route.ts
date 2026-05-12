import { NextResponse } from "next/server";
import { createPasswordRecord, findUser } from "@/lib/auth";
import { verifyEmailCode } from "@/lib/email-verification";
import { createSubscriptionCheckoutSession } from "@/lib/stripe";
import { upsertStoredUser } from "@/lib/user-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const verificationCode = String(body.verificationCode ?? "").trim();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    if (!verificationCode) {
      return NextResponse.json({ error: "Verification code is required." }, { status: 400 });
    }

    const existingUser = findUser(email);

    if (existingUser?.access === "free" || existingUser?.access === "active") {
      return NextResponse.json({ error: "This account already has access. Please log in." }, { status: 409 });
    }

    if (process.env.PAYMENTS_ENABLED !== "true") {
      return NextResponse.json(
        {
          error:
            "Paid signups are still in development. Please check back soon or contact Prompter.com for early access."
        },
        { status: 503 }
      );
    }

    const verification = verifyEmailCode(email, verificationCode);

    if (!verification.ok) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    const checkout = await createSubscriptionCheckoutSession({
      email,
      origin: getOrigin(request)
    });

    if (!checkout.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }

    const passwordRecord = createPasswordRecord(password);
    upsertStoredUser({
      email,
      ...passwordRecord,
      role: "subscriber",
      access: "inactive"
    });

    return NextResponse.json({ checkoutUrl: checkout.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 500 }
    );
  }
}

function getOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}
