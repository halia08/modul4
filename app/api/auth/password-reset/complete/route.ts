import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { getPasswordFingerprint, hashPassword } from "@/lib/auth";
import { verifyPasswordResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Permintaan tidak valid." },
        { status: 400 },
      );
    }

    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmation =
      typeof body.confirmation === "string" ? body.confirmation : "";
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: "Kata sandi harus berisi 8 hingga 128 karakter." },
        { status: 400 },
      );
    }
    if (password !== confirmation) {
      return NextResponse.json(
        { error: "Konfirmasi kata sandi tidak cocok." },
        { status: 400 },
      );
    }

    const claims = verifyPasswordResetToken(token);
    if (!claims) {
      return NextResponse.json(
        { error: "Tautan reset tidak valid atau sudah kedaluwarsa." },
        { status: 400 },
      );
    }

    const user = await prisma.pengguna.findUnique({
      where: { id_user: claims.userId },
      select: { email: true, password: true, status_akun: true },
    });
    if (
      !user ||
      user.email.toLowerCase() !== claims.email.toLowerCase() ||
      user.status_akun.toLowerCase() !== "aktif" ||
      getPasswordFingerprint(user.password) !== claims.passwordFingerprint
    ) {
      return NextResponse.json(
        { error: "Tautan reset tidak valid atau sudah digunakan." },
        { status: 409 },
      );
    }

    const hashedPassword = await hashPassword(password);
    const updated = await prisma.pengguna.updateMany({
      where: {
        id_user: claims.userId,
        email: user.email,
        password: user.password,
        status_akun: user.status_akun,
      },
      data: { password: hashedPassword },
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Tautan reset sudah digunakan. Minta tautan baru." },
        { status: 409 },
      );
    }

    return NextResponse.json({ redirectTo: "/login" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format permintaan tidak valid." },
        { status: 400 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Akun tidak ditemukan." },
        { status: 404 },
      );
    }

    console.error("Password reset could not be completed.", error);
    return NextResponse.json(
      { error: "Kata sandi tidak dapat diperbarui saat ini." },
      { status: 500 },
    );
  }
}