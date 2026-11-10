import { NextResponse } from "next/server";
import {
  createSessionToken,
  dashboardPath,
  hashPassword,
  normalizeUserRole,
  sessionCookieName,
  sessionLifetimeSeconds,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const identifier =
      typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!identifier || identifier.length > 100 || !password || password.length > 128) {
      return NextResponse.json(
        { error: "Masukkan username/email dan password yang valid." },
        { status: 400 },
      );
    }

    const users = await prisma.pengguna.findMany({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
      select: {
        id_user: true,
        username: true,
        email: true,
        password: true,
        role: true,
        status_akun: true,
      },
      take: 2,
    });

    if (users.length > 1) {
      console.error("Authentication blocked: duplicate login identifiers exist.");
      return NextResponse.json(
        { error: "Data akun tidak konsisten. Hubungi pengelola." },
        { status: 409 },
      );
    }

    const user = users[0];
    if (!user) {
      return NextResponse.json(
        { error: "Username/email atau password tidak sesuai." },
        { status: 401 },
      );
    }

    const passwordResult = await verifyPassword(password, user.password);
    if (!passwordResult.valid) {
      return NextResponse.json(
        { error: "Username/email atau password tidak sesuai." },
        { status: 401 },
      );
    }

    if (user.status_akun.toLowerCase() !== "aktif") {
      return NextResponse.json(
        { error: "Akun tidak aktif. Hubungi pengelola." },
        { status: 403 },
      );
    }

    const role = normalizeUserRole(user.role);
    if (!role) {
      return NextResponse.json(
        { error: "Role akun belum dikonfigurasi dengan benar." },
        { status: 403 },
      );
    }

    const now = new Date();
    const passwordHash = passwordResult.needsRehash
      ? await hashPassword(password)
      : user.password;
    await prisma.pengguna.update({
      where: { id_user: user.id_user },
      data: {
        tanggal_login_terakhir: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ),
        ...(passwordResult.needsRehash ? { password: passwordHash } : {}),
      },
    });

    const response = NextResponse.json({ redirectTo: dashboardPath(role) });
    response.cookies.set(
      sessionCookieName,
      createSessionToken(user.id_user, role, passwordHash),
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

    console.error("Login request failed.", error);
    return NextResponse.json(
      { error: "Login tidak dapat diproses saat ini." },
      { status: 500 },
    );
  }
}
