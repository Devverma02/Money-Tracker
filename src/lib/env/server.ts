import { z } from "zod";

function normalizeRuntimeDatabaseUrl(rawUrl: string) {
  const url = new URL(rawUrl);

  if (url.hostname.endsWith("pooler.supabase.com") && url.port === "6543") {
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
  }

  return url.toString();
}

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  STT_PROVIDER: z.string().default("openai"),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
});

export const serverEnv = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL
    ? normalizeRuntimeDatabaseUrl(process.env.DATABASE_URL)
    : process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  STT_PROVIDER: process.env.STT_PROVIDER,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
});
