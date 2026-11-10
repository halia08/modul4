import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  dashboardPath,
  getPasswordFingerprint,
  normalizeUserRole,
  sessionCookieName,
  verifySessionToken,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function DashboardRedirectPage() {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value,
  );
  if (!session) redirect("/login");

  const user = await prisma.pengguna.findUnique({
    where: { id_user: session.userId },
    select: { role: true, status_akun: true, password: true },
  });
  const role = user ? normalizeUserRole(user.role) : null;
  if (
    !user ||
    user.status_akun.toLowerCase() !== "aktif" ||
    role !== session.role ||
    getPasswordFingerprint(user.password) !== session.passwordFingerprint
  ) {
    redirect("/login");
  }

  redirect(dashboardPath(role));
}
