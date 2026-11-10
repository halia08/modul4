import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { createDatabaseId } from "@/lib/ids";
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

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const categoryId = url.searchParams.get("kategori")?.trim();
    const [products, categories] = await Promise.all([
      prisma.produk.findMany({
        where: {
          ...(categoryId ? { id_kategori: categoryId } : {}),
          ...(query
            ? {
                OR: [
                  { nama_produk: { contains: query, mode: "insensitive" } },
                  { id_produk: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: { kategori: { select: { nama_kategori: true } } },
        orderBy: { nama_produk: "asc" },
      }),
      prisma.kategori.findMany({
        select: { id_kategori: true, nama_kategori: true },
        orderBy: { nama_kategori: "asc" },
      }),
    ]);

    return NextResponse.json(
      {
        records: products.map((product) => ({
          id: product.id_produk,
          name: product.nama_produk,
          price: Number(product.harga),
          categoryId: product.id_kategori,
          category: product.kategori.nama_kategori,
        })),
        categories,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Product management data could not be loaded.", error);
    return NextResponse.json(
      { error: "Data produk tidak dapat dimuat saat ini." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) return authorization.response;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Data produk tidak valid." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const categoryId =
      typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const price = parsePrice(body.price);

    if (name.length < 2 || name.length > 100 || !categoryId || price === null) {
      return NextResponse.json(
        { error: "Nama, kategori, dan harga produk wajib valid." },
        { status: 400 },
      );
    }

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

    const product = await prisma.produk.create({
      data: {
        id_produk: createDatabaseId("P", 10),
        nama_produk: name,
        harga: price,
        id_kategori: categoryId,
      },
      select: { id_produk: true },
    });

    return NextResponse.json({ id: product.id_produk }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
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

    console.error("Product could not be created.", error);
    return NextResponse.json(
      { error: "Produk tidak dapat disimpan saat ini." },
      { status: 500 },
    );
  }
}
