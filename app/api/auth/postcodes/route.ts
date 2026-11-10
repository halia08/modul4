import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, ["Pelanggan"]);
  if (!authorization.ok) return authorization.response;

  try {
    const postalCodes = await prisma.kode_pos.findMany({
      select: {
        kode_pos: true,
        kelurahan: true,
        kecamatan: true,
        kota: true,
        provinsi: true,
      },
      orderBy: [{ kota: "asc" }, { kecamatan: "asc" }, { kelurahan: "asc" }],
    });
    return NextResponse.json(
      { postalCodes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Postal-code options could not be loaded.", error);
    return NextResponse.json(
      { error: "Data kode pos tidak dapat dimuat saat ini." },
      { status: 500 },
    );
  }
}
