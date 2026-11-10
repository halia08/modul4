import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import type { UserRole } from "@/lib/auth";
import { createDatabaseId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";

const roles: readonly UserRole[] = ["Admin", "Owner", "Karyawan"];

type ProductionLine = { id_produk: string; jumlah: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLines(value: unknown): ProductionLine[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    return null;
  }

  const grouped = new Map<string, number>();
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id_produk !== "string") {
      return null;
    }
    const id = entry.id_produk.trim();
    const quantity = entry.jumlah;
    if (
      id.length === 0 ||
      id.length > 10 ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100_000
    ) {
      return null;
    }
    const total = (grouped.get(id) ?? 0) + quantity;
    if (total > 100_000) return null;
    grouped.set(id, total);
  }
  return Array.from(grouped, ([id_produk, jumlah]) => ({ id_produk, jumlah }));
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
    const employee =
      authorization.session.role === "Karyawan"
        ? await prisma.karyawan.findFirst({
            where: { id_user: authorization.session.userId },
            select: { id_karyawan: true },
          })
        : null;
    if (authorization.session.role === "Karyawan" && !employee) {
      return NextResponse.json(
        { records: [], inventory: [], needsProfile: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const [records, productionLines, orderLines, products] = await Promise.all([
      prisma.produksi.findMany({
        where: employee ? { id_karyawan: employee.id_karyawan } : {},
        include: {
          karyawan: { select: { nama_karyawan: true } },
          detail_produksi: {
            include: { produk: { select: { nama_produk: true } } },
          },
        },
        orderBy: [{ tgl_produksi: "desc" }, { id_produksi: "desc" }],
        take: 200,
      }),
      prisma.detail_produksi.findMany({
        select: { id_produk: true, jumlah_produksi: true },
      }),
      prisma.detail_pesanan.findMany({
        where: { pesanan: { status_bayar: { not: "Dibatalkan", mode: "insensitive" } } },
        select: { id_produk: true, jumlah: true },
      }),
      prisma.produk.findMany({
        select: { id_produk: true, nama_produk: true },
        orderBy: { nama_produk: "asc" },
      }),
    ]);

    const produced = new Map<string, number>();
    for (const line of productionLines) {
      produced.set(
        line.id_produk,
        (produced.get(line.id_produk) ?? 0) + line.jumlah_produksi,
      );
    }
    const sold = new Map<string, number>();
    for (const line of orderLines) {
      sold.set(line.id_produk, (sold.get(line.id_produk) ?? 0) + line.jumlah);
    }

    return NextResponse.json(
      {
        inventory: products.map((product) => ({
          id: product.id_produk,
          name: product.nama_produk,
          produced: produced.get(product.id_produk) ?? 0,
          ordered: sold.get(product.id_produk) ?? 0,
          estimatedAvailable:
            (produced.get(product.id_produk) ?? 0) -
            (sold.get(product.id_produk) ?? 0),
        })),
        inventoryNote:
          "Perkiraan dihitung dari produksi tercatat dikurangi pesanan, tanpa saldo awal stok.",
        records: records.map((record) => ({
          id: record.id_produksi,
          date: record.tgl_produksi?.toISOString().slice(0, 10) ?? null,
          employee: record.karyawan?.nama_karyawan ?? "Belum ditugaskan",
          stockNotice: record.status_peringatan_stok,
          items: record.detail_produksi.map((line) => ({
            product: line.produk.nama_produk,
            quantity: line.jumlah_produksi,
          })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Production data could not be loaded.", error);
    return NextResponse.json(
      { error: "Data produksi tidak dapat dimuat saat ini." },
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
        { error: "Data produksi tidak valid." },
        { status: 400 },
      );
    }

    const items = parseLines(body.items);
    const date = parseDate(body.date);
    if (!items || (body.date !== undefined && !date)) {
      return NextResponse.json(
        { error: "Produk, jumlah, atau tanggal produksi tidak valid." },
        { status: 400 },
      );
    }

    const ownEmployee =
      authorization.session.role === "Karyawan"
        ? await prisma.karyawan.findFirst({
            where: { id_user: authorization.session.userId },
            select: { id_karyawan: true },
          })
        : null;
    if (authorization.session.role === "Karyawan" && !ownEmployee) {
      return NextResponse.json(
        { error: "Profil karyawan belum tersedia." },
        { status: 409 },
      );
    }

    const requestedEmployee =
      typeof body.id_karyawan === "string" ? body.id_karyawan.trim() : "";
    if (
      ownEmployee &&
      requestedEmployee &&
      requestedEmployee !== ownEmployee.id_karyawan
    ) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const employeeId = ownEmployee?.id_karyawan ?? requestedEmployee;
    const employee = employeeId
      ? await prisma.karyawan.findUnique({
          where: { id_karyawan: employeeId },
          select: { id_karyawan: true },
        })
      : await prisma.karyawan.findFirst({
          orderBy: { id_karyawan: "asc" },
          select: { id_karyawan: true },
        });
    if (!employee) {
      return NextResponse.json(
        { error: "Tambahkan data karyawan sebelum mencatat produksi." },
        { status: 409 },
      );
    }

    const products = await prisma.produk.findMany({
      where: { id_produk: { in: items.map((item) => item.id_produk) } },
      select: { id_produk: true },
    });
    if (products.length !== items.length) {
      return NextResponse.json(
        { error: "Salah satu produk tidak ditemukan." },
        { status: 400 },
      );
    }

    const production = await prisma.produksi.create({
      data: {
        id_produksi: createDatabaseId("PRO", 10),
        tgl_produksi: date ?? new Date(),
        id_karyawan: employee.id_karyawan,
        detail_produksi: {
          create: items.map((item) => ({
            id_detail_produksi: createDatabaseId("DPR", 10),
            id_produk: item.id_produk,
            jumlah_produksi: item.jumlah,
          })),
        },
      },
      select: { id_produksi: true },
    });
    return NextResponse.json({ id: production.id_produksi }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format data tidak valid." },
        { status: 400 },
      );
    }

    console.error("Production could not be recorded.", error);
    return NextResponse.json(
      { error: "Hasil produksi tidak dapat disimpan saat ini." },
      { status: 500 },
    );
  }
}