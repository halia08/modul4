import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";

const orderInclude = {
  detail_pesanan: {
    include: {
      produk: {
        select: {
          id_produk: true,
          nama_produk: true,
          harga: true,
        },
      },
    },
  },
  pelanggan: {
    select: {
      id_pelanggan: true,
      nama_pelanggan: true,
    },
  },
} satisfies Prisma.pesananInclude;

type OrderItemInput = {
  id_produk: string;
  jumlah: number;
};

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new RequestError("The request body must be valid JSON.", 400);
    }

    throw error;
  }
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new RequestError(`${field} is required and must be at most ${maxLength} characters.`, 400);
  }

  return value.trim();
}

function parseItems(value: unknown): OrderItemInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    throw new RequestError("An order must contain between 1 and 50 product lines.", 400);
  }

  const quantities = new Map<string, number>();

  for (const entry of value) {
    if (!isRecord(entry)) {
      throw new RequestError("Each item must contain a product ID and quantity.", 400);
    }

    const id_produk = requiredString(entry.id_produk, "id_produk", 10);
    const jumlah = entry.jumlah;

    if (!Number.isInteger(jumlah) || Number(jumlah) < 1 || Number(jumlah) > 10000) {
      throw new RequestError("Each product quantity must be an integer from 1 to 10,000.", 400);
    }

    const nextQuantity = (quantities.get(id_produk) ?? 0) + Number(jumlah);
    if (nextQuantity > 10000) {
      throw new RequestError("The total quantity of a product cannot exceed 10,000.", 400);
    }

    quantities.set(id_produk, nextQuantity);
  }

  return Array.from(quantities, ([id_produk, jumlah]) => ({ id_produk, jumlah }));
}

function isPaid(status: string): boolean {
  return ["lunas", "dibayar", "paid"].includes(status.trim().toLowerCase());
}

function isCancelled(status: string): boolean {
  return ["batal", "dibatalkan", "cancelled", "canceled"].includes(
    status.trim().toLowerCase(),
  );
}

function makeId(prefix = ""): string {
  return `${prefix}${randomUUID().replaceAll("-", "").slice(0, 10 - prefix.length).toUpperCase()}`;
}

function calculateLines(
  items: OrderItemInput[],
  products: { id_produk: string; harga: Prisma.Decimal }[],
) {
  const productById = new Map(products.map((product) => [product.id_produk, product]));
  let totalCents = 0;

  const lines = items.map((item) => {
    const product = productById.get(item.id_produk);
    if (!product) {
      throw new RequestError(`Product ${item.id_produk} is not available.`, 400);
    }

    const unitPriceCents = Math.round(Number(product.harga.toString()) * 100);
    const subtotalCents = unitPriceCents * item.jumlah;
    if (!Number.isSafeInteger(subtotalCents)) {
      throw new RequestError("The order total is too large.", 400);
    }

    totalCents += subtotalCents;
    if (!Number.isSafeInteger(totalCents) || totalCents > 9_999_999_999) {
      throw new RequestError("The order total exceeds the supported amount.", 400);
    }

    return {
      id_produk: item.id_produk,
      jumlah: item.jumlah,
      subtotal: subtotalCents / 100,
    };
  });

  return { lines, total: totalCents / 100 };
}

async function respond(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "ECONNREFUSED" || error.code === "P1001") {
        return Response.json(
          { error: "Database PostgreSQL tidak dapat dijangkau. Pastikan server aktif, lalu coba lagi." },
          { status: 503 },
        );
      }

      if (error.code === "P2002") {
        return Response.json(
          { error: "An order with this identifier already exists. Please try again." },
          { status: 409 },
        );
      }

      if (error.code === "P2003") {
        return Response.json(
          { error: "The selected customer, employee, or product does not exist." },
          { status: 400 },
        );
      }

      if (error.code === "P2025") {
        return Response.json({ error: "The requested order was not found." }, { status: 404 });
      }
    }

    console.error("Pesanan API request failed.", error);
    return Response.json({ error: "The order request could not be completed." }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  return respond(async () => {
    const [products, allOrders, customers, employees] = await Promise.all([
      prisma.produk.findMany({
        orderBy: { nama_produk: "asc" },
        select: {
          id_produk: true,
          nama_produk: true,
          harga: true,
        },
      }),
      prisma.pesanan.findMany({
        include: orderInclude,
        orderBy: [{ tgl_nota: "desc" }, { no_nota: "desc" }],
      }),
      prisma.pelanggan.findMany({
        select: { id_pelanggan: true, nama_pelanggan: true },
        orderBy: { nama_pelanggan: "asc" },
      }),
      prisma.karyawan.findMany({
        select: { id_karyawan: true, nama_karyawan: true },
        orderBy: { nama_karyawan: "asc" },
      }),
    ]);

    const orders = allOrders.filter((order) => !isCancelled(order.status_bayar));
    return Response.json({ products, orders, customers, employees });
  });
}

export async function POST(request: Request): Promise<Response> {
  return respond(async () => {
    const body = await readJson(request);
    if (!isRecord(body)) {
      throw new RequestError("A JSON order payload is required.", 400);
    }

    const id_pelanggan = requiredString(body.id_pelanggan, "id_pelanggan", 10);
    const id_karyawan = requiredString(body.id_karyawan, "id_karyawan", 10);
    const items = parseItems(body.items);

    const order = await prisma.$transaction(async (transaction) => {
      const products = await transaction.produk.findMany({
        where: { id_produk: { in: items.map((item) => item.id_produk) } },
        select: { id_produk: true, harga: true },
      });
      const { lines, total } = calculateLines(items, products);
      const no_nota = makeId("N");

      await transaction.pesanan.create({
        data: {
          no_nota,
          tgl_nota: new Date(),
          total_bayar: total,
          status_bayar: "Belum Dibayar",
          metode_bayar: null,
          tgl_bayar: null,
          id_pelanggan,
          id_karyawan,
          kode_voucher: null,
          konfirmasi_pembayaran: null,
        },
      });

      await transaction.detail_pesanan.createMany({
        data: lines.map((line) => ({
          id_detail: makeId("D"),
          no_nota,
          id_produk: line.id_produk,
          jumlah: line.jumlah,
          subtotal: line.subtotal,
        })),
      });

      return transaction.pesanan.findUniqueOrThrow({
        where: { no_nota },
        include: orderInclude,
      });
    });

    return Response.json({ order }, { status: 201 });
  });
}

export async function PUT(request: Request): Promise<Response> {
  return respond(async () => {
    const body = await readJson(request);
    if (!isRecord(body)) {
      throw new RequestError("A JSON order payload is required.", 400);
    }

    const no_nota = requiredString(body.no_nota, "no_nota", 10);
    const items = parseItems(body.items);

    const order = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.pesanan.findUnique({
        where: { no_nota },
        select: { no_nota: true, status_bayar: true },
      });

      if (!existing) {
        throw new RequestError("The requested order was not found.", 404);
      }
      if (isPaid(existing.status_bayar)) {
        throw new RequestError("Paid orders cannot be edited.", 409);
      }

      const products = await transaction.produk.findMany({
        where: { id_produk: { in: items.map((item) => item.id_produk) } },
        select: { id_produk: true, harga: true },
      });
      const { lines, total } = calculateLines(items, products);

      await transaction.detail_pesanan.deleteMany({ where: { no_nota } });
      await transaction.detail_pesanan.createMany({
        data: lines.map((line) => ({
          id_detail: makeId("D"),
          no_nota,
          id_produk: line.id_produk,
          jumlah: line.jumlah,
          subtotal: line.subtotal,
        })),
      });
      await transaction.pesanan.update({
        where: { no_nota },
        data: { total_bayar: total },
      });

      return transaction.pesanan.findUniqueOrThrow({
        where: { no_nota },
        include: orderInclude,
      });
    });

    return Response.json({ order });
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return respond(async () => {
    const body = await readJson(request);
    if (!isRecord(body)) {
      throw new RequestError("A JSON order identifier is required.", 400);
    }

    const no_nota = requiredString(body.no_nota, "no_nota", 10);
    await prisma.$transaction(async (transaction) => {
      const order = await transaction.pesanan.findUnique({
        where: { no_nota },
        select: {
          no_nota: true,
          feedback: { select: { id_feedback: true } },
        },
      });

      if (!order) {
        throw new RequestError("The requested order was not found.", 404);
      }
      if (order.feedback.length > 0) {
        throw new RequestError(
          "This order has associated feedback and cannot be permanently deleted.",
          409,
        );
      }

      await transaction.detail_pesanan.deleteMany({ where: { no_nota } });
      await transaction.pesanan.delete({ where: { no_nota } });
    });

    return Response.json({ deleted: no_nota });
  });
}
