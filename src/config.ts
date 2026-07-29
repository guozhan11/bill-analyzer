const DEFAULT_PORT = 3000;

function parsePort(value: string | undefined): number {
  if (!value) return DEFAULT_PORT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535; received ${value}`);
  }
  return parsed;
}

export interface AppConfig {
  host: string;
  port: number;
  environment: string;
  congressApiKey?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    host: env.HOST?.trim() || "127.0.0.1",
    port: parsePort(env.PORT),
    environment: env.NODE_ENV?.trim() || "development",
    congressApiKey: env.CONGRESS_API_KEY?.trim() || undefined
  };
}

export function publicReadiness(config: AppConfig) {
  return {
    status: config.congressApiKey ? "ready" : "needs_configuration",
    checks: {
      congressApiKeyConfigured: Boolean(config.congressApiKey)
    },
    nextAction: config.congressApiKey
      ? null
      : "Set CONGRESS_API_KEY in the server environment before running ingestion."
  };
}
