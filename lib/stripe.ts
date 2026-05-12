const STRIPE_API_BASE = "https://api.stripe.com/v1";

export type StripeCheckoutSession = {
  id: string;
  url?: string;
  customer?: string;
  subscription?: string;
  customer_email?: string;
  client_reference_id?: string;
  metadata?: { email?: string };
};

export async function createSubscriptionCheckoutSession({
  email,
  origin
}: {
  email: string;
  origin: string;
}) {
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("customer_email", email);
  body.set("client_reference_id", email);
  body.set("success_url", `${origin}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${origin}/?signup=cancelled`);
  body.set("payment_method_collection", "always");
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", "499");
  body.set("line_items[0][price_data][recurring][interval]", "month");
  body.set("line_items[0][price_data][product_data][name]", "Prompter.com Pro");
  body.set(
    "line_items[0][price_data][product_data][description]",
    "AI prompt and knowledge base generation for business phone assistants."
  );
  body.set("subscription_data[trial_period_days]", "7");
  body.set("subscription_data[metadata][email]", email);
  body.set("metadata[email]", email);

  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", body);
}

export async function retrieveCheckoutSession(sessionId: string) {
  return stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
    undefined,
    "GET"
  );
}

export async function createBillingPortalSession({
  customerId,
  origin
}: {
  customerId: string;
  origin: string;
}) {
  const body = new URLSearchParams();
  body.set("customer", customerId);
  body.set("return_url", origin);

  return stripeRequest<{ url?: string }>("/billing_portal/sessions", body);
}

async function stripeRequest<T>(pathName: string, body?: URLSearchParams, method = "POST") {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local.");
  }

  const response = await fetch(`${STRIPE_API_BASE}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body
  });

  const payload = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || "Stripe request failed.");
  }

  return payload as T;
}
