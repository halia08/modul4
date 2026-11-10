"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/auth";
import styles from "./dashboard.module.css";

type MetricValues = {
  salesToday: number;
  salesMonth: number;
  products: number;
  pendingOrders: number;
  unansweredFeedback: number;
};

type RecentOrder = {
  id: string;
  customer: string;
  date: string;
  total: number;
  status: string;
};

type DashboardData = {
  role: UserRole;
  metrics: MetricValues;
  recentOrders: RecentOrder[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Dashboard({ role }: { role: UserRole }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || !isRecord(body.metrics)) {
          throw new Error(
            isRecord(body) && typeof body.error === "string"
              ? body.error
              : "Data dashboard tidak dapat dimuat.",
          );
        }

        const metrics = body.metrics;
        const recentOrders = Array.isArray(body.recentOrders)
          ? body.recentOrders.filter(
              (order): order is RecentOrder =>
                isRecord(order) &&
                typeof order.id === "string" &&
                typeof order.customer === "string" &&
                typeof order.date === "string" &&
                typeof order.total === "number" &&
                typeof order.status === "string",
            )
          : [];

        if (
          typeof metrics.salesToday !== "number" ||
          typeof metrics.salesMonth !== "number" ||
          typeof metrics.products !== "number" ||
          typeof metrics.pendingOrders !== "number" ||
          typeof metrics.unansweredFeedback !== "number"
        ) {
          throw new Error("Format data dashboard tidak valid.");
        }

        setData({
          role,
          metrics: {
            salesToday: metrics.salesToday,
            salesMonth: metrics.salesMonth,
            products: metrics.products,
            pendingOrders: metrics.pendingOrders,
            unansweredFeedback: metrics.unansweredFeedback,
          },
          recentOrders,
        });
      })
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Data dashboard tidak dapat dimuat saat ini.",
        );
      });

    return () => controller.abort();
  }, [role]);

  const title =
    role === "Karyawan"
      ? "Selamat Datang, Tim Produksi"
      : `Selamat datang, ${role}`;

  return (
    <div className={styles.dashboard}>
      <header className={styles.heading}>
        <h1>{title}</h1>
        <p>
          Ringkasan aktivitas toko Kerupuk Azizah berdasarkan data terbaru.
        </p>
      </header>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : !data ? (
        <p className={styles.loading} role="status">
          Memuat ringkasan dari database...
        </p>
      ) : (
        <>
          <section className={styles.metrics} aria-label="Ringkasan">
            <article className={styles.metric}>
              <span>Penjualan hari ini</span>
              <strong>{formatCurrency(data.metrics.salesToday)}</strong>
              <small>Total pembayaran pesanan bertanggal hari ini</small>
            </article>
            <article className={styles.metric}>
              <span>Pesanan menunggu</span>
              <strong>{data.metrics.pendingOrders}</strong>
              <small>Perlu tindak lanjut pembayaran</small>
            </article>
            <article className={styles.metric}>
              <span>Produk terdaftar</span>
              <strong>{data.metrics.products}</strong>
              <small>Katalog yang tersimpan di database</small>
            </article>
            <article className={styles.metric}>
              <span>Feedback baru</span>
              <strong>{data.metrics.unansweredFeedback}</strong>
              <small>Belum memiliki tanggapan</small>
            </article>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Pesanan terbaru</h2>
                <p>Data aktual dari transaksi pesanan.</p>
              </div>
                <span className={styles.monthSales}>
                  Penjualan bulan ini {formatCurrency(data.metrics.salesMonth)}
                </span>
            </div>
            {data.recentOrders.length === 0 ? (
              <p className={styles.empty}>Belum ada pesanan.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>No. Nota</th>
                      <th>Pelanggan</th>
                      <th>Tanggal</th>
                      <th>Total</th>
                      <th>Status Bayar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.id}</td>
                        <td>{order.customer}</td>
                        <td>{order.date}</td>
                        <td>{formatCurrency(order.total)}</td>
                        <td>
                          <span className={styles.status}>{order.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
