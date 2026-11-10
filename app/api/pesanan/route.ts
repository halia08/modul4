import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import type { UserRole } from "@/lib/auth";
import { createDatabaseId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";

const staffRoles: readonly UserRole[] = ["Admin", "Owner", "Karyawan"];
const allowedRoles: readonly UserRole[] = [
  ...staffRoles,
  "Pelanggan",
];

type OrderLineInput = { id_produk: string; jumlah: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseItems(value: unknown): OrderLineInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    return null;
  }

  const grouped = new Map<string, number>();
  for (const item of value) {
    if (!isRecord(item) || typeof item.id_produk !== "string") {
      return null;
    }

    const id = item.id_produk.trim();
    const quantity = item.jumlah;
    if (
      id.length === 0 ||
      id.length > 10 ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10_000
    ) {
      return null;
    }

    const total = (grouped.get(id) ?? 0) + quantity;
    if (total > 10_000) {
      return null;
    }
    grouped.set(id, total);
  }

  return Array.from(grouped, ([id_produk, jumlah]) => ({
    id_produk,
    jumlah,
  }));
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, allowedRoles);
  if (!authorization.ok) return authorization.response;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status")?.trim();
    let customerId: string | undefined;

    if (authorization.session.role === "Pelanggan") {
      const customer = await prisma.pelanggan.findFirst({
        where: { id_user: authorization.session.userId },
        select: { id_pelanggan: true },
      });
      if (!customer) {
        return NextResponse.json(
          { orders: [], needsProfile: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      customerId = customer.id_pelanggan;
    }

    const orders = await prisma.pesanan.findMany({
      where: {
        ...(customerId ? { id_pelanggan: customerId } : {}),
        ...(query
          ? {
              OR: [
                { no_nota: { contains: query, mode: "insensitive" } },
                {
                  pelanggan: {
                    nama_pelanggan: { contains: query, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
        ...(status
          ? { status_bayar: { equals: status, mode: "insensitive" } }
          : {}),
      },
      include: {
        pelanggan: { select: { id_pelanggan: true, nama_pelanggan: true } },
        detail_pesanan: {
          include: {
            produk: {
              select: {
                id_produk: true,
                nama_produk: true,
                harga: true,
              },
            },
          },
        },
      },
      orderBy: [{ tgl_nota: "desc" }, { no_nota: "desc" }],
    });

    return NextResponse.json(
      {
        orders: orders.map((order) => ({
          id: order.no_nota,
          date: order.tgl_nota.toISOString().slice(0, 10),
          total: Number(order.total_bayar),
          status: order.status_bayar,
          paymentMethod: order.metode_bayar,
          paymentConfirmation: order.konfirmasi_pembayaran,
          customerId: order.pelanggan.id_pelanggan,
          customer: order.pelanggan.nama_pelanggan,
          items: order.detail_pesanan.map((item) => ({
            productId: item.id_produk,
            name: item.produk.nama_produk,
            quantity: item.jumlah,
            subtotal: Number(item.subtotal),
          })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Orders could not be loaded.", error);
    return NextResponse.json(
      { error: "Data pesanan tidak dapat dimuat saat ini." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, ["Pelanggan"]);
  if (!authorization.ok) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Data pesanan tidak valid." }, { status: 400 });
    }

    const items = parseItems(body.items);
    const paymentMethod =
      typeof body.metode_bayar === "string" ? body.metode_bayar.trim() : "";
    if (!items) {
      return NextResponse.json(
        { error: "Pesanan harus memiliki produk dan jumlah yang valid." },
        { status: 400 },
      );
    }
    if (!["Transfer Bank", "QRIS", "Tunai"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Metode pembayaran tidak valid." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (transaction) => {
        const [customer, employee, products] = await Promise.all([
          transaction.pelanggan.findFirst({
            where: { id_user: authorization.session.userId },
            select: { id_pelanggan: true },
          }),
          transaction.karyawan.findFirst({
            orderBy: { id_karyawan: "asc" },
            select: { id_karyawan: true },
          }),
          transaction.produk.findMany({
            where: { id_produk: { in: items.map((item) => item.id_produk) } },
            select: { id_produk: true, harga: true },
          }),
        ]);

        if (!customer) return { error: "PROFILE_REQUIRED" } as const;
        if (!employee) return { error: "EMPLOYEE_REQUIRED" } as const;
        if (products.length !== items.length) {
          return { error: "PRODUCT_NOT_FOUND" } as const;
        }

        const productById = new Map(
          products.map((product) => [product.id_produk, product]),
        );
        const details = items.map((item) => {
          const product = productById.get(item.id_produk);
          if (!product) {
            throw new Error("Validated order product unexpectedly disappeared.");
          }
          const subtotal =
            Math.round(Number(product.harga) * item.jumlah * 100) / 100;
          return {
            id_detail: createDatabaseId("D", 10),
            id_produk: item.id_produk,
            jumlah: item.jumlah,
            subtotal,
          };
        });
        const total =
          Math.round(
            details.reduce((sum, item) => sum + item.subtotal, 0) * 100,
          ) / 100;
        if (
          total > 99_999_999.99 ||
          details.some((item) => item.subtotal > 99_999_999.99)
        ) {
          return { error: "TOTAL_TOO_LARGE" } as const;
        }

        const order = await transaction.pesanan.create({
          data: {
            no_nota: createDatabaseId("PSN", 10),
            tgl_nota: new Date(),
            total_bayar: total,
            metode_bayar: paymentMethod,
            status_bayar: "Menunggu",
            konfirmasi_pembayaran: "Menunggu",
            id_pelanggan: customer.id_pelanggan,
            id_karyawan: employee.id_karyawan,
            detail_pesanan: { create: details },
          },
          select: { no_nota: true },
        });

        return { order };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if ("error" in result) {
      const issue =
        result.error === "PROFILE_REQUIRED"
          ? {
              status: 409,
              error: "Lengkapi profil pelanggan sebelum membuat pesanan.",
            }
          : result.error === "EMPLOYEE_REQUIRED"
            ? {
                status: 409,
                error:
                  "Pesanan belum dapat dibuat karena belum ada karyawan terdaftar.",
              }
            : result.error === "TOTAL_TOO_LARGE"
              ? {
                  status: 400,
                  error: "Total pesanan melebihi batas transaksi yang didukung.",
                }
              : {
                status: 400,
                error: "Salah satu produk tidak ditemukan.",
                };
      return NextResponse.json({ error: issue.error }, { status: issue.status });
    }

    return NextResponse.json(
      { id: result.order.no_nota },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Pesanan bersamaan terdeteksi. Silakan coba kembali." },
        { status: 409 },
      );
    }

    console.error("Order could not be created.", error);
    return NextResponse.json(
      { error: "Pesanan tidak dapat disimpan saat ini." },
      { status: 500 },
    );
  }
}
