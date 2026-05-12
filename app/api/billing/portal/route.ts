import { NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/stripe";
import { findUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const sessionUser = getSessionFromCookieHeader(request.headers.get("cookie"));

    if (!sessionUser) {
      return NextResponse.json({ error: "Please log in first." }, { status: 401 });
    }

    const user = findUser(sessionUser.email);

    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing profile is connected to this account." }, { status: 400 });
    }

    const portal = await createBillingPortalSession({
      customerId: user.stripeCustomerId,
      origin: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    });

    if (!portal.url) {
      return NextResponse.json({ error: "Stripe did not return a billing portal URL." }, { status: 502 });
    }

    return NextResponse.json({ portalUrl: portal.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open billing portal." },
      { status: 500 }
    );
  }
}
