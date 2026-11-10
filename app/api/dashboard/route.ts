import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/access";
import { prisma } from "@/lib/prisma";

const roles = ["Admin", "Owner", "Karyawan"] as const;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, roles);
  if (!authorization.ok) {
    return authorization.response;
  }

  try {
    const today = startOfDay(new Date());
    const [
      todaySales,
      monthSales,
      productCount,
      pendingOrders,
      unansweredFeedback,
      recentOrders,
    ] = await Promise.all([
      prisma.pesanan.aggregate({
        where: { tgl_nota: today },
        _sum: { total_bayar: true },
      }),
      prisma.pesanan.aggregate({
        where: {
          tgl_nota: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
          },
        },
        _sum: { total_bayar: true },
      }),
      prisma.produk.count(),
      prisma.pesanan.count({
        where: {
          status_bayar: {
            in: ["Menunggu", "Belum Dibayar", "Pending"],
            mode: "insensitive",
          },
        },
      }),
      prisma.feedback.count({
        where: { tanggapan_feedback: { none: {} } },
      }),
      prisma.pesanan.findMany({
        orderBy: [{ tgl_nota: "desc" }, { no_nota: "desc" }],
        take: 6,
        select: {
          no_nota: true,
          tgl_nota: true,
          total_bayar: true,
          status_bayar: true,
          pelanggan: { select: { nama_pelanggan: true } },
        },
      }),
    ]);

    return NextResponse.json(
      {
        role: authorization.session.role,
        metrics: {
          salesToday: Number(todaySales._sum.total_bayar ?? 0),
          salesMonth: Number(monthSales._sum.total_bayar ?? 0),
          products: productCount,
          pendingOrders,
          unansweredFeedback,
        },
        recentOrders: recentOrders.map((order) => ({
          id: order.no_nota,
          customer: order.pelanggan.nama_pelanggan,
          date: order.tgl_nota.toISOString().slice(0, 10),
          total: Number(order.total_bayar),
          status: order.status_bayar,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Dashboard metrics could not be loaded.", error);
    return NextResponse.json(
      { error: "Ringkasan dashboard tidak dapat dimuat saat ini." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
