import { env } from "cloudflare:workers";

export function runtimeEnv(key: string) {
  const workerEnv = env as unknown as Record<string, string | undefined>;
  return workerEnv[key] ?? process.env[key];
}
