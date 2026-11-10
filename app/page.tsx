"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProductImage(name: string): string | null {
  const normalized = name.toLowerCase();
  if (normalized.includes("ubi ungu")) return "/pesanan/ubi-ungu.png";
  if (normalized.includes("bawang pedas") || normalized.includes("pedas")) {
    return "/pesanan/pedas.png";
  }
  if (normalized.includes("tempe")) return "/pesanan/tempe.png";
  if (normalized.includes("nan lamo")) return "/pesanan/bawang-nan-lamo.png";
  if (normalized.includes("kedelai") || normalized.includes("kedele")) {
    return "/pesanan/kedelai.png";
  }
  if (normalized.includes("kentang")) return "/pesanan/kentang.png";
  if (normalized.includes("original")) return "/pesanan/kentang.png";
  return null;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/katalog", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isRecord(body) || !Array.isArray(body.products)) {
          const message =
            isRecord(body) && typeof body.error === "string"
              ? body.error
              : "Katalog produk tidak dapat dimuat.";
          throw new Error(message);
        }

        const records = body.products.filter(
          (item): item is Product =>
            isRecord(item) &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            typeof item.price === "number" &&
            Number.isFinite(item.price) &&
            typeof item.category === "string",
        );
        setProducts(records);
        setError("");
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
            : "Katalog produk tidak dapat dimuat saat ini.",
        );
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery),
    );
  }, [products, query]);
  const visibleProducts = showAll
    ? filteredProducts
    : filteredProducts.slice(0, 3);

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
        <Link className={styles.logoLink} href="/" aria-label="Kerupuk Azizah">
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
          <div className={styles.headerActions}>
            <label className={styles.search}>
              <Image
                src="/pesanan/search-icon.svg"
                alt=""
                aria-hidden="true"
                width={18}
                height={18}
              />
              <input
                aria-label="Cari produk"
                placeholder="Cari Produk . . ."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShowAll(false);
                }}
              />
            </label>
            <Link className={styles.loginButton} href="/login">
              Masuk
            </Link>
            <Link className={styles.registerButton} href="/register">
              Daftar
            </Link>
          </div>
          <nav className={styles.navigation} aria-label="Navigasi utama">
            <a className={styles.activeNav} href="#beranda">
              Beranda
            </a>
            <Link href="/produk">Produk</Link>
            <Link href="/pesanan">Pesanan</Link>
            <a href="#hubungi">Hubungi</a>
          </nav>
        </div>
      </header>

      <section className={styles.hero} id="beranda">
        <div className={styles.heroCopy}>
          <h1>
            Cita Rasa Khas
            <br />
            <span>Minangkabau</span>
          </h1>
          <p>
            Kerupuk Azizah Menghadirkan Kerupuk Khas Minangkabau Dengan Rasa
            Autentik, Bahan Berkualitas, dan Proses Produksi Higienis.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryLink} href="/produk">
              Produk Kami
            </Link>
            <a className={styles.outlineLink} href="#tentang">
              Tentang Kami
            </a>
          </div>
        </div>
        <div className={styles.heroImage}>
          <Image
            src="/pesanan/hero-building.png"
            alt="Rumah Gadang Minangkabau"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 58vw"
          />
        </div>
      </section>

      <section className={styles.products} id="produk" aria-labelledby="products-heading">
        <h2 className={styles.visuallyHidden} id="products-heading">
          Produk Kerupuk Azizah
        </h2>
        {isLoading ? (
          <p className={styles.feedback} role="status">
            Memuat katalog produk...
          </p>
        ) : error ? (
          <p className={styles.feedback} role="alert">
            {error}
          </p>
        ) : filteredProducts.length === 0 ? (
          <p className={styles.feedback}>
            {query
              ? "Produk yang dicari tidak ditemukan."
              : "Belum ada produk yang tersedia."}
          </p>
        ) : (
          <div className={styles.productGrid}>
            {visibleProducts.map((product) => {
              const image = getProductImage(product.name);
              return (
                <Link
                  className={styles.productCard}
                  href="/produk"
                  key={product.id}
                >
                  {image ? (
                    <Image
                      className={styles.productImage}
                      src={image}
                      alt={product.name}
                      width={230}
                      height={200}
                    />
                  ) : (
                    <span className={styles.imageUnavailable}>
                      {product.category}
                    </span>
                  )}
                  <span className={styles.productName}>{product.name}</span>
                  <span className={styles.productPrice}>
                    {formatPrice(product.price)}
                  </span>
                </Link>
              );
            })}
            {filteredProducts.length > 3 && (
              <button
                className={styles.moreProducts}
                type="button"
                onClick={() => setShowAll((current) => !current)}
                aria-expanded={showAll}
              >
                <span className={styles.moreIcon}>•••</span>
                {showAll ? "Lihat Lebih Sedikit" : "Lihat Lebih Banyak"}
              </button>
            )}
          </div>
        )}
      </section>
      <section className={styles.about} id="tentang">
        <h2>Kerupuk Azizah</h2>
        <p>
          Oleh-oleh khas Minangkabau dengan rasa autentik, bahan berkualitas,
          dan proses produksi higienis.
        </p>
      </section>
      <footer className={styles.footer} id="hubungi">
        <span>Kerupuk Azizah · Pusat Oleh-Oleh Khas Minangkabau</span>
        <Link href="/login">Pesan sekarang</Link>
      </footer>
    </main>
  );
}
