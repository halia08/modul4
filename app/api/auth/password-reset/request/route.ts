import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

const genericResponse = {
  message:
    "Jika email terdaftar, tautan untuk mengatur ulang kata sandi akan dikirim.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const email =
      isRecord(body) && typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";
    if (
      !email ||
      email.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Masukkan alamat email yang valid." },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const sender = process.env.RESEND_FROM;
    const appUrl = process.env.APP_URL;
    if (!apiKey || !sender || !appUrl) {
      return NextResponse.json(
        { error: "Layanan email reset belum dikonfigurasi oleh pengelola." },
        { status: 503 },
      );
    }

    let resetUrl: URL;
    try {
      const base = new URL(appUrl);
      if (base.protocol !== "https:" && base.protocol !== "http:") {
        throw new Error("Unsupported application URL protocol.");
      }
      resetUrl = new URL("/reset-password", base.origin);
    } catch (error) {
      console.error("Password-reset application URL is invalid.", error);
      return NextResponse.json(
        { error: "Konfigurasi alamat aplikasi tidak valid." },
        { status: 503 },
      );
    }

    const user = await prisma.pengguna.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id_user: true,
        email: true,
        password: true,
        status_akun: true,
      },
    });
    if (!user || user.status_akun.toLowerCase() !== "aktif") {
      return NextResponse.json(genericResponse, { status: 202 });
    }

    const token = createPasswordResetToken(
      user.id_user,
      user.email,
      user.password,
    );
    resetUrl.searchParams.set("token", token);
    const mailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [user.email],
        subject: "Atur ulang kata sandi Kerupuk Azizah",
        text: `Gunakan tautan berikut dalam 15 menit untuk mengatur ulang kata sandi Anda: ${resetUrl.toString()}`,
        html: `<p>Permintaan untuk mengatur ulang kata sandi akun Kerupuk Azizah diterima.</p><p><a href="${resetUrl.toString()}">Atur ulang kata sandi</a></p><p>Tautan berlaku selama 15 menit dan hanya dapat digunakan sekali.</p>`,
      }),
      cache: "no-store",
    });
    if (!mailResponse.ok) {
      console.error(
        "Password-reset email provider rejected the request.",
        mailResponse.status,
      );
      return NextResponse.json(
        { error: "Email reset tidak dapat dikirim saat ini." },
        { status: 502 },
      );
    }

    return NextResponse.json(genericResponse, { status: 202 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format permintaan tidak valid." },
        { status: 400 },
      );
    }

    console.error("Password-reset request failed.", error);
    return NextResponse.json(
      { error: "Permintaan reset tidak dapat diproses saat ini." },
      { status: 500 },
    );
  }
}