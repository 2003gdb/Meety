import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { packageRoot } from "./env";

export type StoredSession = {
  contextId: string;
  loginSessionId: string | null;
  liveViewUrl: string | null;
  updatedAt: string;
};

const filePath = path.join(packageRoot, "data", "luma-session.json");

export async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as StoredSession;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeSession(session: StoredSession): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(session, null, 2));
}
