import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, signToken, verifyToken } from "@/lib/auth";

const TTL = 60 * 60 * 24 * 7;

function secret(): string {
  return process.env.AUTH_SECRET || "";
}

export async function isAuthed(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifyToken(token, secret());
}

export async function startSession(): Promise<void> {
  const host = (await headers()).get("host") || "";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const token = await signToken(secret(), TTL);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !local,
    sameSite: "lax",
    path: "/",
    maxAge: TTL,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
