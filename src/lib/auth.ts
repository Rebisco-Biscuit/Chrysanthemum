// Single-password auth. The session cookie holds an HMAC of a fixed string keyed by
// APP_PASSWORD, so changing the password logs every device out. Uses Web Crypto so it
// runs in both middleware and route handlers.

export const COOKIE = "afkj_session";

export const authEnabled = () => Boolean(process.env.APP_PASSWORD);

export async function sessionToken(): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.APP_PASSWORD ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("afkj-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(value: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  return value === (await sessionToken());
}
