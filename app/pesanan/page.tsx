"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./pesanan.module.css";

type OrderItem = { productId: string; name: string; quantity: number };
type Order = {
  id: string;
  date: string;
  total: number;
  status: string;
  paymentMethod: string | null;
  paymentConfirmation: string | null;
  items: OrderItem[];
};
type PageState = "loading" | "ready" | "login" | "profile" | "forbidden" | "error";
type Tab = "all" | "cancelled";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<PageState>("loading");
  const [tab, setTab] = useState<Tab>("all");
  const [error, setError] = useState("");
  const [feedbackOrder, setFeedbackOrder] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busyOrder, setBusyOrder] = useState("");

  const loadOrders = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const sessionResponse = await fetch("/api/auth/session", {
        cache: "no-store",
        signal,
      });
      if (sessionResponse.status === 401) {
        setState("login");
        return;
      }
      const session: unknown = await sessionResponse.json();
      if (!sessionResponse.ok || !isRecord(session)) {
        throw new Error("Sesi pengguna tidak dapat diverifikasi.");
      }
      if (session.role !== "Pelanggan") {
        setState("forbidden");
        return;
      }

      const response = await fetch("/api/pesanan", {
        cache: "no-store",
        signal,
      });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body)) {
        throw new Error(
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : "Pesanan tidak dapat dimuat.",
        );
      }
      if (body.needsProfile === true) {
        setState("profile");
        return;
      }
      if (!Array.isArray(body.orders)) {
        throw new Error("Data pesanan tidak memiliki format yang benar.");
      }

      setOrders(
        body.orders.filter(
          (item): item is Order =>
            isRecord(item) &&
            typeof item.id === "string" &&
            typeof item.date === "string" &&
            typeof item.total === "number" &&
            typeof item.status === "string" &&
            Array.isArray(item.items),
        ),
      );
      setState("ready");
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }
      setState("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Pesanan tidak dapat dimuat saat ini.",
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadOrders(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadOrders]);

  const displayedOrders = orders.filter((order) =>
    tab === "cancelled"
      ? order.status.toLowerCase() === "dibatalkan"
      : order.status.toLowerCase() !== "dibatalkan",
  );

  async function cancelOrder(order: Order) {
    if (!window.confirm(`Batalkan pesanan ${order.id}?`)) return;
    setBusyOrder(order.id);
    setError("");
    try {
      const response = await fetch(`/api/pesanan/${encodeURIComponent(order.id)}`, {
        method: "DELETE",
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : "Pesanan tidak dapat dibatalkan.",
        );
      }
      await loadOrders();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Pesanan tidak dapat dibatalkan saat ini.",
      );
    } finally {
      setBusyOrder("");
    }
  }

  async function submitFeedback(orderId: string) {
    setBusyOrder(orderId);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, message: feedback }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : "Ulasan tidak dapat dikirim.",
        );
      }
      setFeedback("");
      setFeedbackOrder("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Ulasan tidak dapat dikirim saat ini.",
      );
    } finally {
      setBusyOrder("");
    }
  }

  return (
    <main className={styles.page}>
      <Image
        className={`${styles.ornament} ${styles.ornamentTop}`}
        src="/pesanan/ornamen.png"
        alt=""
        aria-hidden="true"
        width={179}
        height={170}
        priority
      />
      <Image
        className={`${styles.ornament} ${styles.ornamentBottomLeft}`}
        src="/pesanan/ornamen.png"
        alt=""
        aria-hidden="true"
        width={179}
        height={170}
      />
      <Image
        className={`${styles.ornament} ${styles.ornamentBottomRight}`}
        src="/pesanan/ornamen.png"
        alt=""
        aria-hidden="true"
        width={179}
        height={170}
      />

      <header className={styles.header}>
        <Link href="/" className={styles.logoLink} aria-label="Kerupuk Azizah">
          <Image
            className={styles.logo}
            src="/pesanan/brand-logo.png"
            alt="Kerupuk Azizah — Pusat Oleh-Oleh Khas Minangkabau"
            width={414}
            height={138}
            priority
          />
        </Link>
        <div className={styles.headerRight}>
          <label className={styles.search}>
            <Image
              src="/pesanan/search-icon.svg"
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
            />
            <input aria-label="Cari produk" placeholder="Cari Produk . . ." />
          </label>
          <Link
            className={styles.account}
            href={state === "ready" ? "/pesanan" : "/login"}
            aria-label="Profil pelanggan"
          >
            <Image
              src="/pesanan/profile-icon.svg"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
            />
          </Link>
          <nav className={styles.navigation} aria-label="Navigasi utama">
            <Link href="/">Beranda</Link>
            <Link href="/produk">Produk</Link>
            <Link className={styles.activeNav} href="/pesanan" aria-current="page">
              Pesanan
            </Link>
            <Link href="/#hubungi">Hubungi</Link>
          </nav>
        </div>
      </header>

      <section className={styles.titleBand}>
        <h1>Pesanan Saya</h1>
        <p>
          Pantau status pesanan Anda di sini. Pastikan pesanan Anda
          <br className={styles.desktopBreak} /> sudah sesuai dan sampai dengan baik.
        </p>
      </section>

      <section className={styles.workspace} aria-label="Riwayat pesanan">
        <aside className={styles.accountMenu}>
          <Link className={styles.selectedMenu} href="/pesanan">
            <span aria-hidden="true">▤</span> Pesanan Saya
          </Link>
          <Link className={styles.exitMenu} href="/">
            <span aria-hidden="true">↶</span> Kembali
          </Link>
        </aside>

        <div className={styles.orderPanel}>
          <div className={styles.tabs} role="tablist" aria-label="Filter pesanan">
            <button
              className={tab === "all" ? styles.selectedTab : ""}
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              onClick={() => setTab("all")}
            >
              Semua Pesanan
            </button>
            <button
              className={tab === "cancelled" ? styles.selectedTab : ""}
              type="button"
              role="tab"
              aria-selected={tab === "cancelled"}
              onClick={() => setTab("cancelled")}
            >
              Pembatalan
            </button>
          </div>

          {error && (
            <p className={styles.messageError} role="alert">
              {error}
            </p>
          )}
          {state === "loading" && (
            <p className={styles.emptyState} role="status">
              Memuat riwayat pesanan...
            </p>
          )}
          {state === "error" && (
            <button className={styles.retry} type="button" onClick={() => void loadOrders()}>
              Coba lagi
            </button>
          )}
          {state === "login" && (
            <div className={styles.emptyState}>
              <p>Masuk sebagai pelanggan untuk melihat pesanan Anda.</p>
              <Link className={styles.actionLink} href="/login?next=%2Fpesanan">
                Masuk
              </Link>
            </div>
          )}
          {state === "profile" && (
            <div className={styles.emptyState}>
              <p>Lengkapi profil sebelum melihat dan membuat pesanan.</p>
              <Link className={styles.actionLink} href="/profile/complete">
                Lengkapi Profil
              </Link>
            </div>
          )}
          {state === "forbidden" && (
            <div className={styles.emptyState}>
              <p>Halaman pesanan ini hanya tersedia untuk akun pelanggan.</p>
              <Link className={styles.actionLink} href="/">
                Kembali ke Beranda
              </Link>
            </div>
          )}
          {state === "ready" && displayedOrders.length === 0 && (
            <div className={styles.emptyState}>
              <p>
                {tab === "cancelled"
                  ? "Belum ada pesanan yang dibatalkan."
                  : "Belum ada pesanan. Temukan kerupuk favorit Anda."}
              </p>
              {tab === "all" && (
                <Link className={styles.actionLink} href="/produk">
                  Lihat Produk
                </Link>
              )}
            </div>
          )}

          {state === "ready" && displayedOrders.length > 0 && (
            <div className={styles.orderList}>
              {displayedOrders.map((order) => {
                const status = order.status.toLowerCase();
                const canCancel = status !== "lunas" && status !== "dibatalkan";
                const canReview = status === "lunas";
                const productNames = order.items.map((item) => item.name).join(", ");

                return (
                  <article className={styles.orderCard} key={order.id}>
                    <div className={styles.orderDetails}>
                      <strong>Pesanan {order.id}</strong>
                      <span>
                        <span aria-hidden="true">▦</span> {formatDate(order.date)}
                      </span>
                      <span>
                        <span aria-hidden="true">◇</span>{" "}
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} Produk
                      </span>
                      <span className={styles.productNames}>
                        {productNames || "Rincian produk tidak tersedia"}
                      </span>
                    </div>
                    <div className={styles.orderSummary}>
                      <span className={`${styles.status} ${status === "lunas" ? styles.paid : ""} ${status === "dibatalkan" ? styles.cancelled : ""}`}>
                        <span aria-hidden="true">●</span>
                        {order.status}
                      </span>
                      <strong>{formatPrice(order.total)}</strong>
                      {order.paymentMethod && (
                        <small>{order.paymentMethod}</small>
                      )}
                      {order.paymentConfirmation &&
                        order.paymentConfirmation.toLowerCase() === "menunggu" && (
                          <small>Menunggu konfirmasi</small>
                        )}
                      {canCancel && (
                        <button
                          className={styles.cancelButton}
                          type="button"
                          disabled={busyOrder === order.id}
                          onClick={() => void cancelOrder(order)}
                        >
                          {busyOrder === order.id ? "Memproses..." : "Batalkan"}
                        </button>
                      )}
                      {canReview && (
                        <button
                          className={styles.reviewButton}
                          type="button"
                          onClick={() =>
                            setFeedbackOrder(
                              feedbackOrder === order.id ? "" : order.id,
                            )
                          }
                        >
                          Tulis Ulasan
                        </button>
                      )}
                    </div>
                    {feedbackOrder === order.id && (
                      <form
                        className={styles.feedbackForm}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void submitFeedback(order.id);
                        }}
                      >
                        <label htmlFor={`feedback-${order.id}`}>
                          Ulasan untuk pesanan ini
                        </label>
                        <textarea
                          id={`feedback-${order.id}`}
                          value={feedback}
                          minLength={3}
                          maxLength={255}
                          required
                          onChange={(event) => setFeedback(event.target.value)}
                        />
                        <button
                          className={styles.reviewButton}
                          type="submit"
                          disabled={busyOrder === order.id}
                        >
                          Kirim Ulasan
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
