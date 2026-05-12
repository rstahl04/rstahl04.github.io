export async function sendVerificationEmail({
  email,
  code
}: {
  email: string;
  code: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Prompter.com <onboarding@resend.dev>";

  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Prompter.com verification code",
      text: `Your Prompter.com verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your Prompter.com verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>This code expires in 10 minutes.</p>`
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || "Unable to send verification email.");
  }

  return { sent: true };
}
