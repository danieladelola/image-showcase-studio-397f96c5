import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GENERIC_FAIL = "That email and password don't match an admin account.";

export const getAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { currentAdmin } = await import("./admin-session.server");
  const { withDb } = await import("./db.server");
  const [admin, count] = await Promise.all([
    currentAdmin(),
    withDb(async (sql) => (await sql`SELECT count(*)::int AS n FROM admin_users`)[0]!.n as number),
  ]);
  return { admin, needsSetup: count === 0 };
});

export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2, "Enter your name.").max(80),
        email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(255),
        password: z.string().min(10, "Use at least 10 characters.").max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    const { hashPassword } = await import("./password");
    const { startSession } = await import("./admin-session.server");
    const passwordHash = await hashPassword(data.password);
    // Only allowed while no admin exists; the conditional insert closes the race.
    const created = await withDb(
      (sql) => sql`
        INSERT INTO admin_users (name, email, password_hash)
        SELECT ${data.name}, ${data.email}, ${passwordHash}
        WHERE NOT EXISTS (SELECT 1 FROM admin_users)
        RETURNING id`,
    );
    if (!created[0]) return { ok: false as const, message: "An admin account already exists. Please sign in." };
    await startSession(String(created[0].id), true);
    return { ok: true as const };
  });

export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(255),
        password: z.string().min(1, "Enter your password.").max(200),
        remember: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    const { verifyPassword } = await import("./password");
    const { startSession } = await import("./admin-session.server");
    const rows = await withDb((sql) => sql`SELECT id, password_hash FROM admin_users WHERE email = ${data.email}`);
    const user = rows[0];
    const ok = user ? await verifyPassword(data.password, String(user.password_hash)) : false;
    if (!user || !ok) return { ok: false as const, message: GENERIC_FAIL };
    await startSession(String(user.id), data.remember);
    return { ok: true as const };
  });

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("./admin-session.server");
  await endSession();
  return { ok: true as const };
});

export const addAdminUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2, "Enter a name.").max(80),
        email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(255),
        password: z.string().min(10, "Use at least 10 characters.").max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    const { withDb } = await import("./db.server");
    const { hashPassword } = await import("./password");
    await requireAdmin();
    const passwordHash = await hashPassword(data.password);
    const rows = await withDb(
      (sql) => sql`
        INSERT INTO admin_users (name, email, password_hash) VALUES (${data.name}, ${data.email}, ${passwordHash})
        ON CONFLICT (email) DO NOTHING RETURNING id`,
    );
    if (!rows[0]) return { ok: false as const, message: "An admin with that email already exists." };
    return { ok: true as const };
  });
