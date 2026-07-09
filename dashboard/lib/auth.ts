const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

export const SESSION_COOKIE = "wlog_session";

export type Role = "admin" | "employee";

export type Session = {
  role: Role;
  handle: string;
  username: string;
  sid: string;
  exp: number;
};

export async function signToken(
  secret: string,
  session: { role: Role; handle: string; username: string; sid: string },
  ttlSeconds: number,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = b64urlEncode(
    encoder.encode(
      JSON.stringify({
        r: session.role,
        h: session.handle,
        u: session.username,
        s: session.sid,
        exp,
      }),
    ),
  );
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

export async function verifyToken(
  token: string | undefined,
  secret: string,
): Promise<Session | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(secret, body);
  if (sig !== expected) return null;
  try {
    const obj = JSON.parse(decoder.decode(b64urlDecode(body)));
    const exp = Number(obj.exp);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000))
      return null;
    const role: Role = obj.r === "admin" ? "admin" : "employee";
    return {
      role,
      handle: String(obj.h || ""),
      username: String(obj.u || obj.h || ""),
      sid: String(obj.s || ""),
      exp,
    };
  } catch {
    return null;
  }
}

const PBKDF2_ITERATIONS = 100000;

async function pbkdf2(
  password: string,
  salt: BufferSource,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(derived)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations)) return false;
  const salt = b64urlDecode(parts[2]);
  const derived = await pbkdf2(password, salt, iterations);
  const expected = b64urlEncode(derived);
  if (expected.length !== parts[3].length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ parts[3].charCodeAt(i);
  return diff === 0;
}
