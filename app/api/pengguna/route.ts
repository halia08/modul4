import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { hashPassword } from "@/lib/auth";
import { createDatabaseId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, ["Admin", "Owner"]);
  if (!authorization.ok) return authorization.response;

  try {
    const users = await prisma.pengguna.findMany({
      select: {
        id_user: true,
        username: true,
        email: true,
        role: true,
        status_akun: true,
        tanggal_registrasi: true,
        karyawan: { select: { nama_karyawan: true } },
        pelanggan: { select: { nama_pelanggan: true } },
      },
      orderBy: [{ role: "asc" }, { username: "asc" }],
    });
    return NextResponse.json(
      {
        records: users.map((user) => ({
          id: user.id_user,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status_akun,
          registered: user.tanggal_registrasi.toISOString().slice(0, 10),
          displayName:
            user.karyawan[0]?.nama_karyawan ??
            user.pelanggan[0]?.nama_pelanggan ??
            user.username,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("User records could not be loaded.", error);
    return NextResponse.json(
      { error: "Data pengguna tidak dapat dimuat saat ini." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, ["Admin", "Owner"]);
  if (!authorization.ok) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Data pengguna tidak valid." },
        { status: 400 },
      );
    }

    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    if (
      username.length < 3 ||
      username.length > 50 ||
      email.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      password.length > 128 ||
      !["Admin", "Karyawan", "Pelanggan"].includes(role)
    ) {
      return NextResponse.json(
        { error: "Nama pengguna, email, kata sandi, atau role tidak valid." },
        { status: 400 },
      );
    }
    if (role === "Admin" && authorization.session.role !== "Owner") {
      return NextResponse.json(
        { error: "Hanya Owner yang dapat menambahkan Admin." },
        { status: 403 },
      );
    }

    const existingUser = await prisma.pengguna.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: "insensitive" } },
          { email: { equals: email, mode: "insensitive" } },
        ],
      },
      select: { id_user: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Nama pengguna atau email sudah terdaftar." },
        { status: 409 },
      );
    }

    let employeeProfile:
      | {
          name: string;
          title: string;
          phone: string;
          postalCode: string;
        }
      | undefined;
    if (role === "Karyawan") {
      const employee = isRecord(body.employee) ? body.employee : null;
      const name =
        typeof employee?.name === "string" ? employee.name.trim() : "";
      const title =
        typeof employee?.title === "string" ? employee.title.trim() : "";
      const phone =
        typeof employee?.phone === "string" ? employee.phone.trim() : "";
      const postalCode =
        typeof employee?.postalCode === "string"
          ? employee.postalCode.trim()
          : "";
      if (
        name.length < 2 ||
        name.length > 100 ||
        title.length < 2 ||
        title.length > 50 ||
        !/^[0-9+()\-\s]{8,15}$/.test(phone) ||
        postalCode.length === 0 ||
        postalCode.length > 10
      ) {
        return NextResponse.json(
          { error: "Lengkapi nama, jabatan, telepon, dan kode pos karyawan." },
          { status: 400 },
        );
      }
      employeeProfile = { name, title, phone, postalCode };
    }

    const id = createDatabaseId("USR", 10);
    const hashedPassword = await hashPassword(password);
    const user = await prisma.pengguna.create({
      data: {
        id_user: id,
        username,
        email,
        password: hashedPassword,
        role,
        status_akun: "Aktif",
        tanggal_registrasi: new Date(),
        ...(employeeProfile
          ? {
              karyawan: {
                create: {
                  id_karyawan: createDatabaseId("KRY", 10),
                  nama_karyawan: employeeProfile.name,
                  jabatan: employeeProfile.title,
                  no_hp: employeeProfile.phone,
                  kode_pos: employeeProfile.postalCode,
                },
              },
            }
          : {}),
      },
      select: { id_user: true },
    });
    return NextResponse.json({ id: user.id_user }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format data tidak valid." },
        { status: 400 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Nama pengguna atau email sudah terdaftar." },
        { status: 409 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Kode pos atau data relasi tidak ditemukan." },
        { status: 400 },
      );
    }

    console.error("User could not be created.", error);
    return NextResponse.json(
      { error: "Pengguna tidak dapat disimpan saat ini." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeRequest(request, ["Admin", "Owner"]);
  if (!authorization.ok) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Perubahan pengguna tidak valid." },
        { status: 400 },
      );
    }
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!id || id.length > 10 || !["Aktif", "Nonaktif"].includes(status)) {
      return NextResponse.json(
        { error: "ID pengguna atau status tidak valid." },
        { status: 400 },
      );
    }
    const target = await prisma.pengguna.findUnique({
      where: { id_user: id },
      select: { role: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 },
      );
    }
    if (
      authorization.session.role === "Admin" &&
      !["pelanggan", "karyawan"].includes(target.role.toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Admin hanya dapat mengelola akun pelanggan dan karyawan." },
        { status: 403 },
      );
    }
    if (id === authorization.session.userId && status !== "Aktif") {
      return NextResponse.json(
        { error: "Akun yang sedang digunakan tidak dapat dinonaktifkan." },
        { status: 409 },
      );
    }

    const user = await prisma.pengguna.update({
      where: { id_user: id },
      data: { status_akun: status },
      select: { id_user: true },
    });
    return NextResponse.json({ id: user.id_user });
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
        { error: "Pengguna tidak ditemukan." },
        { status: 404 },
      );
    }

    console.error("User account could not be updated.", error);
    return NextResponse.json(
      { error: "Akun tidak dapat diperbarui saat ini." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeRequest(request, ["Admin", "Owner"]);
  if (!authorization.ok) return authorization.response;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 10) {
    return NextResponse.json(
      { error: "ID pengguna tidak valid." },
      { status: 400 },
    );
  }
  if (id === authorization.session.userId) {
    return NextResponse.json(
      { error: "Akun yang sedang digunakan tidak dapat dinonaktifkan." },
      { status: 409 },
    );
  }

  try {
    const target = await prisma.pengguna.findUnique({
      where: { id_user: id },
      select: { role: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 },
      );
    }
    if (
      authorization.session.role === "Admin" &&
      !["pelanggan", "karyawan"].includes(target.role.toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Admin hanya dapat mengelola akun pelanggan dan karyawan." },
        { status: 403 },
      );
    }
    await prisma.pengguna.update({
      where: { id_user: id },
      data: { status_akun: "Nonaktif" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 },
      );
    }

    console.error("User account could not be deactivated.", error);
    return NextResponse.json(
      { error: "Akun tidak dapat dinonaktifkan saat ini." },
      { status: 500 },
    );
  }
}