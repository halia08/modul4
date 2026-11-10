import type { ReactNode } from "react";
import ManagementShell from "@/app/ui/management-shell";
import { requirePageRole } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function KaryawanLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requirePageRole("Karyawan");
  const user = await prisma.pengguna.findUnique({
    where: { id_user: session.userId },
    select: { username: true },
  });

  if (!user) {
    throw new Error("Authenticated user record is missing.");
  }

  return (
    <ManagementShell role="Karyawan" identity={user.username}>
      {children}
    </ManagementShell>
  );
}
