import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { normalize, type AppState } from "./state";

const KEY = "afkj:state";
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// Local fallback for development only; Vercel's filesystem is not persistent.
const FILE = path.join(process.cwd(), ".data", "state.json");

export async function loadState(): Promise<AppState> {
  if (redis) return normalize(await redis.get(KEY));
  try {
    return normalize(JSON.parse(await fs.readFile(FILE, "utf8")));
  } catch {
    return normalize(null);
  }
}

export async function saveState(state: AppState): Promise<void> {
  if (redis) {
    await redis.set(KEY, state);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(state, null, 2));
}
