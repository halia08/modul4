import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { createDatabaseId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";

const roles = ["Admin", "Owner"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;

  try {
    const records = await prisma.laporan.findMany({
      include: { pengguna: { select: { username: true } } },
      orderBy: { id_laporan: "desc" },
    });
    return NextResponse.json(
      {
        records: records.map((report) => ({
          id: report.id_laporan,
          type: report.jenis_laporan,
          total: Number(report.total_laporan),
          author: report.pengguna.username,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Reports could not be loaded.", error);
    return NextResponse.json(
      { error: "Data laporan tidak dapat dimuat saat ini." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Data laporan tidak valid." },
        { status: 400 },
      );
    }

    const type = typeof body.type === "string" ? body.type.trim() : "";
    const from = parseDate(body.from);
    const to = parseDate(body.to);
    if (
      !["Penjualan", "Pesanan"].includes(type) ||
      !from ||
      !to ||
      from > to
    ) {
      return NextResponse.json(
        { error: "Jenis laporan dan rentang tanggal harus valid." },
        { status: 400 },
      );
    }

    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const where = {
      tgl_nota: { gte: from, lt: toExclusive },
      ...(type === "Penjualan"
        ? { status_bayar: { equals: "Lunas", mode: "insensitive" as const } }
        : {}),
    };
    const [orderCount, totals] = await Promise.all([
      prisma.pesanan.count({ where }),
      prisma.pesanan.aggregate({
        where,
        _sum: { total_bayar: true },
      }),
    ]);

    const label = `${type} ${body.from} s.d. ${body.to}`;
    if (label.length > 50) {
      return NextResponse.json(
        { error: "Rentang laporan terlalu panjang untuk disimpan." },
        { status: 400 },
      );
    }

    const report = await prisma.laporan.create({
      data: {
        id_laporan: createDatabaseId("LAP", 10),
        jenis_laporan: label,
        total_laporan:
          type === "Penjualan" ? Number(totals._sum.total_bayar ?? 0) : orderCount,
        id_user: authorization.session.userId,
      },
      select: { id_laporan: true },
    });
    return NextResponse.json({ id: report.id_laporan }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format data tidak valid." },
        { status: 400 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Akun pembuat laporan tidak ditemukan." },
        { status: 409 },
      );
    }

    console.error("Report could not be generated.", error);
    return NextResponse.json(
      { error: "Laporan tidak dapat dibuat saat ini." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 10) {
    return NextResponse.json(
      { error: "ID laporan tidak valid." },
      { status: 400 },
    );
  }

  try {
    await prisma.laporan.delete({ where: { id_laporan: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Laporan tidak ditemukan." },
        { status: 404 },
      );
    }

    console.error("Report could not be deleted.", error);
    return NextResponse.json(
      { error: "Laporan tidak dapat dihapus saat ini." },
      { status: 500 },
    );
  }
}