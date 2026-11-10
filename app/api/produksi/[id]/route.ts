import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { prisma } from "@/lib/prisma";

const roles = ["Admin", "Owner", "Karyawan"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/produksi/[id]">,
) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.stockNotice !== "string") {
      return NextResponse.json(
        { error: "Status peringatan stok tidak valid." },
        { status: 400 },
      );
    }

    const stockNotice = body.stockNotice.trim();
    if (stockNotice.length > 50) {
      return NextResponse.json(
        { error: "Status peringatan stok terlalu panjang." },
        { status: 400 },
      );
    }

    if (authorization.session.role === "Karyawan") {
      const employee = await prisma.karyawan.findFirst({
        where: { id_user: authorization.session.userId },
        select: { id_karyawan: true },
      });
      if (!employee) {
        return NextResponse.json(
          { error: "Profil karyawan belum tersedia." },
          { status: 409 },
        );
      }

      const ownedRecord = await prisma.produksi.findFirst({
        where: { id_produksi: id, id_karyawan: employee.id_karyawan },
        select: { id_produksi: true },
      });
      if (!ownedRecord) {
        return NextResponse.json(
          { error: "Data produksi tidak ditemukan." },
          { status: 404 },
        );
      }
    }

    await prisma.produksi.update({
      where: { id_produksi: id },
      data: { status_peringatan_stok: stockNotice || null },
    });
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format data tidak valid." },
        { status: 400 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Data produksi tidak ditemukan." },
        { status: 404 },
      );
    }

    console.error("Production record could not be updated.", error);
    return NextResponse.json(
      { error: "Data produksi tidak dapat diperbarui saat ini." },
      { status: 500 },
    );
  }
}
