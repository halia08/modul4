import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import {
  createSessionToken,
  hashPassword,
  sessionCookieName,
  sessionLifetimeSeconds,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function newUserId(): string {
  return `U${randomBytes(7).toString("base64url").slice(0, 9)}`;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const email =
      typeof body.identifier === "string"
        ? body.identifier.trim().toLowerCase()
        : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmation =
      typeof body.confirmation === "string" ? body.confirmation : "";

    if (
      email.length > 50 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Gunakan alamat email yang valid sebagai username." },
        { status: 400 },
      );
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: "Password harus berisi 8 hingga 128 karakter." },
        { status: 400 },
      );
    }
    if (password !== confirmation) {
      return NextResponse.json(
        { error: "Konfirmasi password tidak cocok." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(
      async (transaction) => {
        const duplicate = await transaction.pengguna.findFirst({
          where: {
            OR: [
              { email: { equals: email, mode: "insensitive" } },
              { username: { equals: email, mode: "insensitive" } },
            ],
          },
          select: { id_user: true },
        });

        if (duplicate) {
          return null;
        }

        return transaction.pengguna.create({
          data: {
            id_user: newUserId(),
            username: email,
            email,
            password: passwordHash,
            role: "Pelanggan",
            status_akun: "Aktif",
            tanggal_registrasi: new Date(),
          },
          select: { id_user: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!user) {
      return NextResponse.json(
        { error: "Email tersebut sudah terdaftar." },
        { status: 409 },
      );
    }

    const response = NextResponse.json(
      { redirectTo: "/profile/complete" },
      { status: 201 },
    );
    response.cookies.set(
      sessionCookieName,
      createSessionToken(user.id_user, "Pelanggan", passwordHash),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: sessionLifetimeSeconds,
      },
    );
    return response;
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
        { error: "Pendaftaran bersamaan terdeteksi. Silakan coba kembali." },
        { status: 409 },
      );
    }

    console.error("Registration request failed.", error);
    return NextResponse.json(
      { error: "Pendaftaran tidak dapat diproses saat ini." },
      { status: 500 },
    );
  }
}
