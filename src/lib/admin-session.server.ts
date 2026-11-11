import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { withDb } from "./db.server";
import { randomToken, sha256Hex } from "./password";

export const SESSION_COOKIE = "ruwata_admin";
const LONG_SESSION_DAYS = 30;
const SHORT_SESSION_HOURS = 12;

export type AdminUser = { id: string; name: string; email: string };

const cookieBase = {
  httpOnly: true,
  secure: true,
  // The editor preview runs in a cross-site frame, so the cookie must be allowed there.
  sameSite: "none" as const,
  partitioned: true,
  path: "/",
};

export async function startSession(adminId: string, remember: boolean) {
  const token = randomToken();
  const ms = remember ? LONG_SESSION_DAYS * 86_400_000 : SHORT_SESSION_HOURS * 3_600_000;
  const expires = new Date(Date.now() + ms);
  await withDb(async (sql) => {
    await sql`DELETE FROM admin_sessions WHERE admin_id = ${adminId} AND expires_at < now()`;
    await sql`INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (${await sha256Hex(token)}, ${adminId}, ${expires})`;
  });
  setCookie(SESSION_COOKIE, token, remember ? { ...cookieBase, expires } : cookieBase);
}

export async function currentAdmin(): Promise<AdminUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const hash = await sha256Hex(token);
  const rows = await withDb(
    (sql) => sql<AdminUser[]>`
      SELECT u.id, u.name, u.email FROM admin_sessions s
      JOIN admin_users u ON u.id = s.admin_id
      WHERE s.token_hash = ${hash} AND s.expires_at > now()`,
  );
  return rows[0] ?? null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) throw new Error("Unauthorized");
  return admin;
}

export async function endSession() {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const hash = await sha256Hex(token);
    await withDb((sql) => sql`DELETE FROM admin_sessions WHERE token_hash = ${hash}`);
  }
  deleteCookie(SESSION_COOKIE, cookieBase);
}
