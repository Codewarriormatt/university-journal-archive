import { config } from "../config/env.js";
import { logger } from "./logger.js";

function parseSender(from) {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { email: from.trim() };
}

export async function sendMagicLink(toEmail, rawToken, redirectPath = "/") {
  const verifyUrl = `${config.baseUrl}/login/verify?token=${encodeURIComponent(rawToken)}&redirect=${encodeURIComponent(redirectPath)}`;

  if (!config.email.brevoApiKey) {
    // Development only: no Brevo key, so print the sign-in link to the server console instead of emailing it
    if (process.env.NODE_ENV !== "production") {
      logger.warn("BREVO_API_KEY not set (dev mode). Open this sign-in link in your browser:", { verifyUrl });
      return;
    }
    throw Object.assign(new Error("Email service is not configured."), { code: "EMAIL_NOT_CONFIGURED" });
  }

  const sender = parseSender(config.email.from);

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": config.email.brevoApiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender,
      to: [{ email: toEmail }],
      subject: "Your sign-in link",
      textContent: [
        "Click the link below to sign in to the Journal Repository.",
        "",
        verifyUrl,
        "",
        "This link expires in 15 minutes and can only be used once.",
        "If you did not request this, you can ignore this email."
      ].join("\n"),
      htmlContent: `
        <p>Click the button below to sign in to the Journal Repository.</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}"
             style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Sign in
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px;">
          Or copy this link into your browser:<br>
          <a href="${verifyUrl}" style="color:#1d4ed8;">${verifyUrl}</a>
        </p>
        <p style="color:#6b7280;font-size:14px;">
          This link expires in 15 minutes and can only be used once.<br>
          If you did not request this, you can ignore this email.
        </p>
      `
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Brevo error: ${error.message ?? response.status}`);
  }

  logger.info("Magic link email sent");
}
