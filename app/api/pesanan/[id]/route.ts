import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { prisma } from "@/lib/prisma";

const managementRoles = ["Admin", "Owner"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/pesanan/[id]">,
) {
  const authorization = await authorizeRequest(request, managementRoles);
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Perubahan pesanan tidak valid." }, { status: 400 });
    }

    const status =
      typeof body.status === "string" ? body.status.trim() : undefined;
    const confirmation =
      typeof body.confirmation === "string"
        ? body.confirmation.trim()
        : undefined;
    const method =
      typeof body.paymentMethod === "string"
        ? body.paymentMethod.trim()
        : undefined;

    if (
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
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    console.error("Order could not be updated.", error);
    return NextResponse.json(
      { error: "Pesanan tidak dapat diperbarui saat ini." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/pesanan/[id]">,
) {
  const authorization = await authorizeRequest(request, ["Pelanggan"]);
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;

  try {
    const customer = await prisma.pelanggan.findFirst({
      where: { id_user: authorization.session.userId },
      select: { id_pelanggan: true },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "Profil pelanggan belum dilengkapi." },
        { status: 409 },
      );
    }

    const order = await prisma.pesanan.findFirst({
      where: { no_nota: id, id_pelanggan: customer.id_pelanggan },
      select: { status_bayar: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }
    if (order.status_bayar.toLowerCase() === "lunas") {
      return NextResponse.json(
        { error: "Pesanan yang sudah dibayar tidak dapat dibatalkan." },
        { status: 409 },
      );
    }

    const updated = await prisma.pesanan.updateMany({
      where: {
        no_nota: id,
        id_pelanggan: customer.id_pelanggan,
        status_bayar: { not: "Lunas", mode: "insensitive" },
      },
      data: { status_bayar: "Dibatalkan" },
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Status pesanan berubah. Muat ulang sebelum mencoba kembali." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Order cancellation failed.", error);
    return NextResponse.json(
      { error: "Pesanan tidak dapat dibatalkan saat ini." },
      { status: 500 },
    );
  }
}
