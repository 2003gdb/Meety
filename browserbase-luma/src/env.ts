import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

config({ path: path.join(root, ".env") });

export const packageRoot = root;

export function requireApiKey(): string {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    throw new Error("Set BROWSERBASE_API_KEY in browserbase-luma/.env");
  }
  return apiKey;
}

export function projectId(): string | undefined {
  return process.env.BROWSERBASE_PROJECT_ID || undefined;
}
