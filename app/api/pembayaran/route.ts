import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { prisma } from "@/lib/prisma";

const roles = ["Admin", "Owner"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;

  try {
    const orders = await prisma.pesanan.findMany({
      include: { pelanggan: { select: { nama_pelanggan: true } } },
      orderBy: [{ tgl_nota: "desc" }, { no_nota: "desc" }],
    });
    const paidOrders = orders.filter(
      (order) => order.status_bayar.toLowerCase() === "lunas",
    );

    return NextResponse.json(
      {
        metrics: {
          totalPaid: paidOrders.reduce(
            (total, order) => total + Number(order.total_bayar),
            0,
          ),
          totalOrders: orders.length,
          awaitingConfirmation: orders.filter(
            (order) =>
              order.konfirmasi_pembayaran?.toLowerCase() === "menunggu",
          ).length,
        },
        records: orders.map((order) => ({
          id: order.no_nota,
          customer: order.pelanggan.nama_pelanggan,
          date: order.tgl_nota.toISOString().slice(0, 10),
          total: Number(order.total_bayar),
          method: order.metode_bayar ?? "Belum dipilih",
          status: order.status_bayar,
          confirmation: order.konfirmasi_pembayaran ?? "Menunggu",
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Payment data could not be loaded.", error);
    return NextResponse.json(
      { error: "Data pembayaran tidak dapat dimuat saat ini." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Perubahan pembayaran tidak valid." },
        { status: 400 },
      );
    }

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status =
      typeof body.status === "string" ? body.status.trim() : undefined;
    const confirmation =
      typeof body.confirmation === "string"
        ? body.confirmation.trim()
        : undefined;
    const method =
      typeof body.method === "string" ? body.method.trim() : undefined;

    if (
      !id ||
      id.length > 10 ||
      (status !== undefined &&
        !["Menunggu", "Lunas", "Dibatalkan"].includes(status)) ||
      (confirmation !== undefined &&
        !["Menunggu", "Terkonfirmasi", "Ditolak"].includes(confirmation)) ||
      (method !== undefined &&
        !["Transfer Bank", "QRIS", "Tunai"].includes(method)) ||
      (status === undefined &&
        confirmation === undefined &&
        method === undefined)
    ) {
      return NextResponse.json(
        { error: "Status atau metode pembayaran tidak valid." },
        { status: 400 },
      );
    }

    const order = await prisma.pesanan.update({
      where: { no_nota: id },
      data: {
        ...(status ? { status_bayar: status } : {}),
        ...(confirmation ? { konfirmasi_pembayaran: confirmation } : {}),
        ...(method ? { metode_bayar: method } : {}),
        ...(status === "Lunas" ? { tgl_bayar: new Date() } : {}),
        ...(status && status !== "Lunas" ? { tgl_bayar: null } : {}),
      },
      select: { no_nota: true },
    });
    return NextResponse.json({ id: order.no_nota });
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
        { error: "Pesanan tidak ditemukan." },
        { status: 404 },
      );
    }

    console.error("Payment could not be updated.", error);
    return NextResponse.json(
      { error: "Pembayaran tidak dapat diperbarui saat ini." },
      { status: 500 },
    );
  }
}