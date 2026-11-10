import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { prisma } from "@/lib/prisma";

const roles = ["Admin", "Owner"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePrice(value: unknown): number | null {
  const price = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(price) || price <= 0 || price > 99_999_999.99) {
    return null;
  }
  return Math.round(price * 100) / 100;
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/produk/[id]">,
) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Data produk tidak valid." }, { status: 400 });
    }

    const name =
      body.name === undefined
        ? undefined
        : typeof body.name === "string"
          ? body.name.trim()
          : null;
    const categoryId =
      body.categoryId === undefined
        ? undefined
        : typeof body.categoryId === "string"
          ? body.categoryId.trim()
          : null;
    const price =
      body.price === undefined ? undefined : parsePrice(body.price);

    if (
      name === null ||
      (name !== undefined && (name.length < 2 || name.length > 100)) ||
      categoryId === null ||
      (body.price !== undefined && (price === null || price === undefined)) ||
      (body.price !== undefined && price === undefined) ||
      (categoryId !== undefined && !categoryId)
    ) {
      return NextResponse.json(
        { error: "Periksa kembali nama, kategori, dan harga produk." },
        { status: 400 },
      );
    }

    if (categoryId) {
      const category = await prisma.kategori.findUnique({
        where: { id_kategori: categoryId },
        select: { id_kategori: true },
      });
      if (!category) {
        return NextResponse.json(
          { error: "Kategori produk tidak ditemukan." },
          { status: 400 },
        );
      }
    }

    const product = await prisma.produk.update({
      where: { id_produk: id },
      data: {
        ...(name !== undefined ? { nama_produk: name } : {}),
        ...(price !== undefined && price !== null ? { harga: price } : {}),
        ...(categoryId !== undefined
          ? { kategori: { connect: { id_kategori: categoryId } } }
          : {}),
      },
      select: { id_produk: true },
    });
    return NextResponse.json({ id: product.id_produk });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan." },
        { status: 404 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Kategori tidak dapat digunakan untuk produk ini." },
        { status: 409 },
      );
    }

    console.error("Product could not be updated.", error);
    return NextResponse.json(
      { error: "Produk tidak dapat diperbarui saat ini." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/produk/[id]">,
) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;

  try {
    const [orders, production] = await Promise.all([
      prisma.detail_pesanan.count({ where: { id_produk: id } }),
      prisma.detail_produksi.count({ where: { id_produk: id } }),
    ]);
    if (orders > 0 || production > 0) {
      return NextResponse.json(
        {
          error:
            "Produk sudah digunakan pada pesanan atau produksi dan tidak dapat dihapus.",
        },
        { status: 409 },
      );
    }

    await prisma.produk.delete({ where: { id_produk: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2025" || error.code === "P2003")
    ) {
      return NextResponse.json(
        {
          error:
            error.code === "P2025"
              ? "Produk tidak ditemukan."
              : "Produk sudah digunakan pada pesanan atau produksi dan tidak dapat dihapus.",
        },
        { status: error.code === "P2025" ? 404 : 409 },
      );
    }

    console.error("Product could not be deleted.", error);
    return NextResponse.json(
      { error: "Produk tidak dapat dihapus saat ini." },
      { status: 500 },
    );
  }
}
