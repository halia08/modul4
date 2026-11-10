"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import styles from "./produk.module.css";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
};
type CartLine = { id: string; quantity: number };
type PaymentMethod = "Transfer Bank" | "QRIS" | "Tunai";
const cartStorageKey = "kerupuk-azizah-cart";

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

function getProductImage(name: string): string | null {
  const normalized = name.toLowerCase();
  if (normalized.includes("ubi ungu")) return "/pesanan/ubi-ungu.png";
  if (normalized.includes("bawang pedas") || normalized.includes("pedas")) {
    return "/pesanan/pedas.png";
  }
  if (normalized.includes("tempe")) return "/pesanan/tempe.png";
  if (normalized.includes("nan lamo")) {
    return "/pesanan/bawang-nan-lamo.png";
  }
  if (normalized.includes("kedelai") || normalized.includes("kedele")) {
    return "/pesanan/kedelai.png";
  }
  if (normalized.includes("kentang") || normalized.includes("stik")) {
    return "/pesanan/kentang.png";
  }
  if (normalized.includes("original")) return "/pesanan/kentang.png";
  if (normalized.includes("bawang")) return "/pesanan/pedas.png";
  return null;
}

export default function ProductCatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("Transfer Bank");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/katalog", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || !Array.isArray(body.products)) {
          throw new Error(
            isRecord(body) && typeof body.error === "string"
              ? body.error
              : "Katalog produk tidak dapat dimuat.",
          );
        }
        setProducts(
          body.products.filter(
            (item): item is Product =>
              isRecord(item) &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              typeof item.price === "number" &&
              typeof item.category === "string",
          ),
        );
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
            : "Katalog produk tidak dapat dimuat.",
        );
      })
      .finally(() => setLoading(false));

    const cartTimer = window.setTimeout(() => {
      try {
        const savedCart: unknown = JSON.parse(
          window.localStorage.getItem(cartStorageKey) ?? "[]",
        );
        if (Array.isArray(savedCart)) {
          setCart(
            savedCart.filter(
              (line): line is CartLine =>
                isRecord(line) &&
                typeof line.id === "string" &&
                typeof line.quantity === "number" &&
                Number.isInteger(line.quantity) &&
                line.quantity > 0 &&
                line.quantity <= 10_000,
            ),
          );
        }
      } catch (storageError) {
        console.error("Saved cart could not be read.", storageError);
      } finally {
        setCartReady(true);
      }
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(cartTimer);
    };
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartReady]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(normalized) ||
        product.category.toLowerCase().includes(normalized),
    );
  }, [products, query]);

  const cartItems = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.id);
    return product ? [{ product, quantity: line.quantity }] : [];
  });
  const cartCount = cartItems.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );

  function addToCart(product: Product) {
    setError("");
    setMessage(`${product.name} ditambahkan ke keranjang.`);
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.id === product.id
            ? { ...line, quantity: Math.min(line.quantity + 1, 10_000) }
            : line,
        );
      }
      return [...current, { id: product.id, quantity: 1 }];
    });
  }

  function changeQuantity(id: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) => current.filter((line) => line.id !== id));
      return;
    }
    setCart((current) =>
      current.map((line) =>
        line.id === id ? { ...line, quantity: Math.min(quantity, 10_000) } : line,
      ),
    );
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cartItems.length === 0 || submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const sessionResponse = await fetch("/api/auth/session", {
        cache: "no-store",
      });
      if (sessionResponse.status === 401) {
        router.push("/login?next=%2Fproduk");
        return;
      }
      const session: unknown = await sessionResponse.json();
      if (!sessionResponse.ok || !isRecord(session)) {
        throw new Error("Sesi pengguna tidak dapat diverifikasi.");
      }
      if (session.role !== "Pelanggan") {
        throw new Error("Pemesanan hanya dapat dilakukan melalui akun pelanggan.");
      }

      const response = await fetch("/api/pesanan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((line) => ({
            id_produk: line.product.id,
            jumlah: line.quantity,
          })),
          metode_bayar: paymentMethod,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        if (
          response.status === 409 &&
          isRecord(body) &&
          typeof body.error === "string" &&
          body.error.includes("Lengkapi profil")
        ) {
          router.push("/profile/complete");
          return;
        }
        throw new Error(
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : "Pesanan tidak dapat dibuat.",
        );
      }

      setCart([]);
      setMessage(
        isRecord(body) && typeof body.id === "string"
          ? `Pesanan ${body.id} berhasil dibuat. Silakan pantau statusnya di Pesanan Saya.`
          : "Pesanan berhasil dibuat.",
      );
      window.localStorage.removeItem(cartStorageKey);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Pesanan tidak dapat dibuat saat ini.",
      );
    } finally {
      setSubmitting(false);
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
        <div className={styles.headerContent}>
          <label className={styles.search}>
            <Image
              src="/pesanan/search-icon.svg"
              alt=""
              aria-hidden="true"
              width={21}
              height={21}
            />
            <input
              aria-label="Cari produk"
              placeholder="Cari Produk . . ."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <Link className={styles.account} href="/pesanan" aria-label="Akun saya">
            <Image
              src="/pesanan/profile-icon.svg"
              alt=""
              aria-hidden="true"
              width={42}
              height={42}
            />
          </Link>
          <nav className={styles.navigation} aria-label="Navigasi utama">
            <Link href="/">Beranda</Link>
            <Link className={styles.activeNav} href="/produk" aria-current="page">
              Produk
            </Link>
            <Link href="/pesanan">Pesanan</Link>
            <Link href="/#hubungi">Hubungi</Link>
          </nav>
        </div>
      </header>

      <section className={styles.catalog} aria-label="Katalog produk">
        {loading ? (
          <p className={styles.feedback} role="status">
            Memuat katalog produk...
          </p>
        ) : error && products.length === 0 ? (
          <p className={styles.feedback} role="alert">
            {error}
          </p>
        ) : visibleProducts.length === 0 ? (
          <p className={styles.feedback}>Produk tidak ditemukan.</p>
        ) : (
          <div className={styles.productGrid}>
            {visibleProducts.map((product) => {
              const image = getProductImage(product.name);
              return (
                <button
                  className={styles.productCard}
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  aria-label={`Tambah ${product.name} ke keranjang, ${formatPrice(product.price)}`}
                >
                  <span className={styles.imageFrame}>
                    {image ? (
                      <Image
                        src={image}
                        alt={product.name}
                        fill
                        sizes="(max-width: 760px) 42vw, 232px"
                      />
                    ) : (
                      <span className={styles.imageFallback}>
                        Kerupuk Azizah
                      </span>
                    )}
                  </span>
                  <strong>{product.name}</strong>
                  <span className={styles.price}>{formatPrice(product.price)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {(cartCount > 0 || message || error) && (
        <section className={styles.cartPanel} aria-label="Keranjang pesanan">
          {cartCount > 0 ? (
            <form onSubmit={submitOrder}>
              <div className={styles.cartHeading}>
                <h1>Keranjang Pesanan</h1>
                <span>{cartCount} produk</span>
              </div>
              <div className={styles.cartLines}>
                {cartItems.map(({ product, quantity }) => (
                  <div className={styles.cartLine} key={product.id}>
                    <span>{product.name}</span>
                    <span>{formatPrice(product.price * quantity)}</span>
                    <div className={styles.quantity}>
                      <button
                        type="button"
                        aria-label={`Kurangi ${product.name}`}
                        onClick={() => changeQuantity(product.id, quantity - 1)}
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Tambah ${product.name}`}
                        onClick={() => changeQuantity(product.id, quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <label className={styles.paymentLabel}>
                Metode pembayaran
                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value as PaymentMethod)
                  }
                >
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Tunai">Tunai</option>
                </select>
              </label>
              <div className={styles.totalRow}>
                <span>Total</span>
                <strong>{formatPrice(cartTotal)}</strong>
              </div>
              <button
                className={styles.checkoutButton}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Memproses..." : "Buat Pesanan"}
              </button>
            </form>
          ) : null}
          {message && (
            <p className={styles.successMessage} role="status">
              {message}{" "}
              {message.includes("berhasil dibuat") && (
                <Link href="/pesanan">Buka Pesanan Saya</Link>
              )}
            </p>
          )}
          {error && (
            <p className={styles.errorMessage} role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
