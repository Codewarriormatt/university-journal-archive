export const config = {
  port: Number.parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: process.env.DATABASE_URL ?? "",
  allowedOrigins: parseAllowedOrigins(
    process.env.ALLOWED_ORIGINS ??
      "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173"
  ),
  trustProxy: process.env.TRUST_PROXY === "true",
  baseUrl: process.env.BASE_URL ?? "http://localhost:5173",
  email: {
    brevoApiKey: process.env.BREVO_API_KEY ?? "",
    from: process.env.EMAIL_FROM ?? "",
    replyTo: process.env.EMAIL_REPLY_TO ?? ""
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiInsightIntervalMs: Number.parseInt(process.env.AI_INSIGHT_INTERVAL_MS ?? "300000", 10),
  openaiApiKey: process.env.OPENAI_API_KEY ?? ""
};

function parseAllowedOrigins(value) {
  return String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
