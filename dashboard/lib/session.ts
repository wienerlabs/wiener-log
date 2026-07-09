import "server-only";
import { cookies, headers } from "next/headers";
import {
  SESSION_COOKIE,
  signToken,
  verifyToken,
  type Role,
  type Session,
} from "@/lib/auth";

const TTL = 60 * 60 * 24 * 7;

function secret(): string {
  return process.env.AUTH_SECRET || "";
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifyToken(token, secret());
}

export async function isAuthed(): Promise<boolean> {
  return (await getSession()) !== null;
}

export async function isAdmin(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

export async function startSession(
  role: Role,
  handle: string,
  username: string,
  sid: string,
): Promise<void> {
  const host = (await headers()).get("host") || "";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const token = await signToken(secret(), { role, handle, username, sid }, TTL);
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
