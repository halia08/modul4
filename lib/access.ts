import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  dashboardPath,
  getSessionFromRequest,
  getPasswordFingerprint,
  normalizeUserRole,
  sessionCookieName,
  verifySessionToken,
  type Session,
  type UserRole,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AuthorizationResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

function unauthorized(): AuthorizationResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error: "Sesi tidak valid. Silakan masuk kembali." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    ),
  };
}

export async function authorizeRequest(
  request: Request,
  allowedRoles: readonly UserRole[],
): Promise<AuthorizationResult> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorized();
  }

  const user = await prisma.pengguna.findUnique({
    where: { id_user: session.userId },
    select: { role: true, status_akun: true, password: true },
  });
  if (
    !user ||
    user.status_akun.toLowerCase() !== "aktif" ||
    normalizeUserRole(user.role) !== session.role ||
    getPasswordFingerprint(user.password) !== session.passwordFingerprint
  ) {
    return unauthorized();
  }

  if (!allowedRoles.includes(session.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akses ditolak." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return { ok: true, session };
}

export async function requirePageRole(role: UserRole): Promise<Session> {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value,
  );
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.pengguna.findUnique({
    where: { id_user: session.userId },
    select: { role: true, status_akun: true, password: true },
  });
  const databaseRole = user ? normalizeUserRole(user.role) : null;

  if (
    !user ||
    user.status_akun.toLowerCase() !== "aktif" ||
    databaseRole !== session.role ||
    getPasswordFingerprint(user.password) !== session.passwordFingerprint
  ) {
    redirect("/login");
  }
  if (session.role !== role) {
    redirect(dashboardPath(session.role));
  }

  return session;
}
