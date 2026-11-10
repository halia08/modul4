import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const records = await prisma.produk.findMany({
      select: {
        id_produk: true,
        nama_produk: true,
        harga: true,
        kategori: { select: { nama_kategori: true } },
      },
      orderBy: { nama_produk: "asc" },
    });

    const products = records.map((product) => ({
      id: product.id_produk,
      name: product.nama_produk,
      price: Number(product.harga),
      category: product.kategori.nama_kategori,
    }));

    if (products.some((product) => !Number.isFinite(product.price))) {
      throw new Error("A product price is not a finite number.");
    }

    return NextResponse.json(
      { products },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Product catalog could not be loaded.", error);
    return NextResponse.json(
      { error: "Katalog produk tidak dapat dimuat saat ini." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
