import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";

const roles = ["Admin", "Owner", "Karyawan", "Pelanggan"] as const;

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) {
    return authorization.response;
  }

  return NextResponse.json(
    {
      userId: authorization.session.userId,
      role: authorization.session.role,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
