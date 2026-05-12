# Prompter.com

Simple MVP web app for generating a customized AI phone assistant prompt and factual business knowledge base from a public business website.

## What It Does

- Collects business type, website URL, and additional instructions.
- Scrapes same-origin public HTML pages from the business website.
- Prioritizes common useful pages such as home, about, services, contact, FAQ, booking, pricing, hours, and location pages.
- Skips private or sensitive paths such as login, account, portal, checkout, payment, admin, cart, and protected-style pages.
- Calls OpenAI from a Next.js API route so the API key stays private on the backend.
- Returns copyable sections:
  - Customized AI Prompt
  - Welcome Message
  - Knowledge Base
  - Business Info Summary
  - Services Found
  - Hours Found
  - Booking Rules
  - Transfer Rules
  - Missing Info to Confirm

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your private backend key to `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
NEXT_PUBLIC_APP_URL=http://localhost:3000
PAYMENTS_ENABLED=false
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM=Prompter.com <verify@yourdomain.com>
AUTH_SECRET=change-this-to-a-long-random-secret
PROMPTER_USERS_JSON=[{"email":"owner@example.com","password":"change-this-password","role":"owner","access":"free"},{"email":"employee@example.com","password":"employee-password","role":"employee","access":"free"}]
```

## Access Control

Prompter.com has a simple MVP login system.

- Add yourself with `"role":"owner"` and `"access":"free"`.
- Add employees with `"role":"employee"` and `"access":"free"` so they can use it without paying.
- Later, paid users can be stored with `"access":"active"`.
- Users with `"access":"inactive"` are blocked.

For a production subscription system, move users/passwords into a database such as Supabase, store hashed passwords, and update the same access check after Stripe or another billing provider confirms subscription status.

## Subscription Checkout

The public homepage now lets visitors sign up before using the generator.

- Keep `PAYMENTS_ENABLED=false` while paid signup is paused. Visitors who try to sign up will see a friendly "still in development" message instead of being sent to Stripe.
- Set `PAYMENTS_ENABLED=true` and restart the app when you are ready to turn Stripe Checkout back on.
- Sign-up first sends a 6-digit email verification code.
- The user must enter the code before Stripe Checkout opens.
- Sign-up creates a Stripe Checkout subscription for `$4.99/month`.
- Stripe Checkout collects payment information before the trial starts.
- The subscription uses a 7-day free trial.
- After checkout succeeds, the app marks the user as active and logs them in.
- Paid users can open the Stripe billing portal from the app to cancel anytime.

Email delivery uses Resend when `RESEND_API_KEY` is configured. Without Resend configured, local development returns the code on screen for testing.

This MVP stores signed-up users in `data/users.json` and temporary verification codes in `data/email-codes.json` for local testing. Use Supabase or another real database before deploying publicly.

To clean up the hosted Stripe Checkout page, go to Stripe Dashboard -> Settings -> Business -> Branding and add your logo, icon, brand color, and accent color. The app also sends a cleaner product name and description: `Prompter.com Pro`.

Then run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes

- The frontend never receives the OpenAI API key.
- The generator is accuracy-first. It instructs the AI not to invent facts and to list missing items under `Missing Info to Confirm`.
- Some websites block scraping or render key content only in client-side JavaScript. In those cases, the app returns warnings and the AI should mark missing information clearly.
- This MVP is ready for later additions such as saved projects, Supabase auth/database, downloadable files, phone assistant platform integration, calendar integration, and Vercel deployment.
