import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function profileId(): string {
  return `PL${randomBytes(7).toString("base64url").slice(0, 8)}`;
}

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
    return NextResponse.json({ postalCodes });
  } catch (error) {
    console.error("Customer profile options could not be loaded.", error);
    return NextResponse.json(
      { error: "Data alamat tidak dapat dimuat saat ini." },
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
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const gender =
      body.gender === "Laki-Laki" || body.gender === "Perempuan"
        ? body.gender
        : null;
    const postalCode =
      typeof body.postalCode === "string" ? body.postalCode.trim() : "";
    const birthDate =
      typeof body.birthDate === "string" && body.birthDate
        ? new Date(`${body.birthDate}T00:00:00.000Z`)
        : null;

    if (
      name.length < 2 ||
      name.length > 100 ||
      !/^[+\d\s()-]{8,15}$/.test(phone) ||
      address.length < 5 ||
      address.length > 100 ||
      postalCode.length > 10 ||
      (birthDate && Number.isNaN(birthDate.getTime()))
    ) {
      return NextResponse.json(
        { error: "Periksa kembali nama, nomor telepon, alamat, dan kode pos." },
        { status: 400 },
      );
    }

    const customer = await prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.pelanggan.findFirst({
          where: { id_user: authorization.session.userId },
          select: { id_pelanggan: true },
        });
        if (existing) {
          return null;
        }

        const postalCodeExists = await transaction.kode_pos.findUnique({
          where: { kode_pos: postalCode },
          select: { kode_pos: true },
        });
        if (!postalCodeExists) {
          return undefined;
        }

        return transaction.pelanggan.create({
          data: {
            id_pelanggan: profileId(),
            nama_pelanggan: name,
            no_hp: phone,
            alamat: address,
            jenis_kelamin: gender,
            tgl_lahir: birthDate,
            id_user: authorization.session.userId,
            kode_pos: postalCode,
          },
          select: { id_pelanggan: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (customer === null) {
      return NextResponse.json(
        { error: "Profil pelanggan sudah pernah dilengkapi." },
        { status: 409 },
      );
    }
    if (customer === undefined) {
      return NextResponse.json(
        { error: "Kode pos tidak ditemukan." },
        { status: 400 },
      );
    }

    return NextResponse.json({ redirectTo: "/" }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format permintaan tidak valid." },
        { status: 400 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Perubahan profil bersamaan terdeteksi. Silakan coba kembali." },
        { status: 409 },
      );
    }

    console.error("Customer profile could not be saved.", error);
    return NextResponse.json(
      { error: "Profil tidak dapat disimpan saat ini." },
      { status: 500 },
    );
  }
}
