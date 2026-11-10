import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import type { UserRole } from "@/lib/auth";
import { createDatabaseId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";

const roles: readonly UserRole[] = ["Admin", "Owner", "Karyawan", "Pelanggan"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;

  try {
    let orderFilter = {};
    if (authorization.session.role === "Pelanggan") {
      const customer = await prisma.pelanggan.findFirst({
        where: { id_user: authorization.session.userId },
        select: { id_pelanggan: true },
      });
      if (!customer) {
        return NextResponse.json(
          { records: [], needsProfile: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      orderFilter = { pesanan: { id_pelanggan: customer.id_pelanggan } };
    }

    const records = await prisma.feedback.findMany({
      where: orderFilter,
      include: {
        pesanan: {
          select: {
            no_nota: true,
            tgl_nota: true,
            pelanggan: { select: { nama_pelanggan: true } },
          },
        },
        tanggapan_feedback: {
          include: { karyawan: { select: { nama_karyawan: true } } },
          orderBy: { tgl_tanggapan: "asc" },
        },
      },
      orderBy: [{ tgl_feedback: "desc" }, { id_feedback: "desc" }],
      take: 200,
    });

    return NextResponse.json(
      {
        records: records.map((record) => ({
          id: record.id_feedback,
          orderId: record.pesanan.no_nota,
          customer: record.pesanan.pelanggan.nama_pelanggan,
          date: record.tgl_feedback.toISOString().slice(0, 10),
          message: record.isi_feedback,
          replies: record.tanggapan_feedback.map((reply) => ({
            message: reply.isi_tanggapan,
            date: reply.tgl_tanggapan.toISOString().slice(0, 10),
            employee: reply.karyawan.nama_karyawan,
          })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Feedback could not be loaded.", error);
    return NextResponse.json(
      { error: "Data ulasan tidak dapat dimuat saat ini." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, ["Pelanggan"]);
  if (!authorization.ok) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Data ulasan tidak valid." },
        { status: 400 },
      );
    }
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (
      !orderId ||
      orderId.length > 10 ||
      message.length < 3 ||
      message.length > 255
    ) {
      return NextResponse.json(
        { error: "Pilih pesanan dan tulis ulasan (3–255 karakter)." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (transaction) => {
        const customer = await transaction.pelanggan.findFirst({
          where: { id_user: authorization.session.userId },
          select: { id_pelanggan: true },
        });
        if (!customer) return { error: "PROFILE_REQUIRED" } as const;

        const order = await transaction.pesanan.findFirst({
          where: {
            no_nota: orderId,
            id_pelanggan: customer.id_pelanggan,
            status_bayar: { equals: "Lunas", mode: "insensitive" },
          },
          select: {
            no_nota: true,
            feedback: { select: { id_feedback: true }, take: 1 },
          },
        });
        if (!order) return { error: "ORDER_NOT_FOUND" } as const;
        if (order.feedback.length > 0) return { error: "ALREADY_REVIEWED" } as const;

        const feedback = await transaction.feedback.create({
          data: {
            id_feedback: createDatabaseId("FDB", 10),
            isi_feedback: message,
            tgl_feedback: new Date(),
            no_nota: order.no_nota,
          },
          select: { id_feedback: true },
        });
        return { id: feedback.id_feedback } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if ("error" in result) {
      const error =
        result.error === "PROFILE_REQUIRED"
          ? {
              status: 409,
              message: "Lengkapi profil pelanggan terlebih dahulu.",
            }
          : result.error === "ORDER_NOT_FOUND"
            ? {
                status: 404,
                message:
                  "Ulasan hanya dapat diberikan untuk pesanan yang telah dibayar.",
              }
            : {
                status: 409,
                message: "Pesanan ini sudah memiliki ulasan.",
              };
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format data tidak valid." },
        { status: 400 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return NextResponse.json(
        { error: "Pesanan ini sudah memiliki ulasan." },
        { status: 409 },
      );
    }

    console.error("Feedback could not be submitted.", error);
    return NextResponse.json(
      { error: "Ulasan tidak dapat disimpan saat ini." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeRequest(request, ["Karyawan"]);
  if (!authorization.ok) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Tanggapan tidak valid." },
        { status: 400 },
      );
    }
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : "";
    if (!id || id.length > 10 || message.length < 3 || message.length > 255) {
      return NextResponse.json(
        { error: "ID ulasan atau tanggapan tidak valid." },
        { status: 400 },
      );
    }

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

    const existing = await prisma.feedback.findUnique({
      where: { id_feedback: id },
      select: {
        id_feedback: true,
        tanggapan_feedback: {
          select: { id_tanggapan: true },
          take: 1,
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ulasan tidak ditemukan." }, { status: 404 });
    }

    const reply = existing.tanggapan_feedback[0]
      ? await prisma.tanggapan_feedback.update({
          where: {
            id_tanggapan: existing.tanggapan_feedback[0].id_tanggapan,
          },
          data: {
            isi_tanggapan: message,
            tgl_tanggapan: new Date(),
            id_karyawan: employee.id_karyawan,
          },
          select: { id_tanggapan: true },
        })
      : await prisma.tanggapan_feedback.create({
          data: {
            id_tanggapan: createDatabaseId("TGP", 10),
            isi_tanggapan: message,
            tgl_tanggapan: new Date(),
            id_feedback: existing.id_feedback,
            id_karyawan: employee.id_karyawan,
          },
          select: { id_tanggapan: true },
        });
    return NextResponse.json({ id: reply.id_tanggapan });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format data tidak valid." },
        { status: 400 },
      );
    }

    console.error("Feedback response could not be saved.", error);
    return NextResponse.json(
      { error: "Tanggapan tidak dapat disimpan saat ini." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeRequest(request, ["Pelanggan"]);
  if (!authorization.ok) return authorization.response;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 10) {
    return NextResponse.json({ error: "ID ulasan tidak valid." }, { status: 400 });
  }

  try {
    const record = await prisma.feedback.findFirst({
      where: {
        id_feedback: id,
        pesanan: {
          pelanggan: { id_user: authorization.session.userId },
        },
      },
      select: {
        id_feedback: true,
        tanggapan_feedback: { select: { id_tanggapan: true }, take: 1 },
      },
    });
    if (!record) {
      return NextResponse.json({ error: "Ulasan tidak ditemukan." }, { status: 404 });
    }
    if (record.tanggapan_feedback.length > 0) {
      return NextResponse.json(
        { error: "Ulasan yang sudah ditanggapi tidak dapat dihapus." },
        { status: 409 },
      );
    }
    await prisma.feedback.delete({ where: { id_feedback: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Feedback could not be deleted.", error);
    return NextResponse.json(
      { error: "Ulasan tidak dapat dihapus saat ini." },
      { status: 500 },
    );
  }
}