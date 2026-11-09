"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./pesanan.module.css";

type Product = {
  id_produk: string;
  nama_produk: string;
  harga: number | string;
};

type OrderLine = {
  id_detail: string;
  id_produk: string;
  jumlah: number;
  subtotal: number | string;
  produk: Product;
};

type Order = {
  no_nota: string;
  tgl_nota: string;
  total_bayar: number | string;
  status_bayar: string;
  detail_pesanan: OrderLine[];
  pelanggan: {
    id_pelanggan: string;
    nama_pelanggan: string;
  };
};

type Customer = {
  id_pelanggan: string;
  nama_pelanggan: string;
};

type Employee = {
  id_karyawan: string;
  nama_karyawan: string;
};

type OrderData = {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  employees: Employee[];
};

type DraftLine = {
  id_produk: string;
  jumlah: number;
};

type ApiError = {
  error?: string;
};

const productPhotos: Record<string, string> = {
  P01: "/pesanan/kentang.png",
  P02: "/pesanan/kentang.png",
  P03: "/pesanan/kedelai.png",
  P04: "/pesanan/kentang.png",
  P05: "/pesanan/pedas.png",
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function money(value: number | string): string {
  return rupiah.format(Number(value));
}

function isPaid(status: string): boolean {
  return ["lunas", "dibayar", "paid"].includes(status.trim().toLowerCase());
}

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

async function readError(response: Response): Promise<string> {
  const payload = (await response.json()) as ApiError;
  return payload.error ?? "Permintaan tidak dapat diproses.";
}

function ProductImage({
  product,
  className,
}: {
  product: Product;
  className: string;
}) {
  return (
    <div className={`${styles.productImage} ${className}`}>
      <Image
        src={productPhotos[product.id_produk] ?? "/pesanan/kedelai.png"}
        alt={product.nama_produk}
        fill
        sizes="(max-width: 700px) 90vw, 260px"
      />
    </div>
  );
}

export default function PesananPage() {
  const [data, setData] = useState<OrderData>({
    products: [],
    orders: [],
    customers: [],
    employees: [],
  });
  const [view, setView] = useState<"orders" | "products">("orders");
  const [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [extraProduct, setExtraProduct] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/pesanan", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    const nextData = (await response.json()) as OrderData;
    setData(nextData);
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/pesanan", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readError(response));
        }
        return (await response.json()) as OrderData;
      })
      .then((nextData) => {
        if (active) {
          setData(nextData);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Data pesanan gagal dimuat.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return data.products.filter((product) =>
      product.nama_produk.toLocaleLowerCase("id-ID").includes(query),
    );
  }, [data.products, search]);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return data.orders.filter((order) => {
      const matchesQuery =
        !query ||
        order.no_nota.toLocaleLowerCase("id-ID").includes(query) ||
        order.detail_pesanan.some((line) =>
          line.produk.nama_produk.toLocaleLowerCase("id-ID").includes(query),
        );
      return matchesQuery && (!pendingOnly || !isPaid(order.status_bayar));
    });
  }, [data.orders, pendingOnly, search]);

  const draftTotal = useMemo(
    () =>
      draftLines.reduce((total, line) => {
        const product = data.products.find((item) => item.id_produk === line.id_produk);
        return total + (product ? Number(product.harga) * line.jumlah : 0);
      }, 0),
    [data.products, draftLines],
  );

  function closeModal() {
    setSelectedProduct(null);
    setEditingOrder(null);
    setDraftLines([]);
    setExtraProduct("");
    setCustomerId("");
    setEmployeeId("");
    setModalError("");
  }

  function openCreate(product: Product) {
    setSelectedProduct(product);
    setEditingOrder(null);
    setDraftLines([{ id_produk: product.id_produk, jumlah: 1 }]);
    setCustomerId("");
    setEmployeeId("");
    setModalError("");
  }

  function openEdit(order: Order) {
    setEditingOrder(order);
    setSelectedProduct(null);
    setDraftLines(
      order.detail_pesanan.map((line) => ({
        id_produk: line.id_produk,
        jumlah: line.jumlah,
      })),
    );
    setExtraProduct("");
    setModalError("");
  }

  function changeQuantity(id_produk: string, jumlah: number) {
    setDraftLines((current) =>
      current.map((line) =>
        line.id_produk === id_produk ? { ...line, jumlah: Math.max(1, jumlah) } : line,
      ),
    );
  }

  function addProductLine() {
    if (!extraProduct || draftLines.some((line) => line.id_produk === extraProduct)) {
      return;
    }
    setDraftLines((current) => [...current, { id_produk: extraProduct, jumlah: 1 }]);
    setExtraProduct("");
  }

  function removeProductLine(id_produk: string) {
    setDraftLines((current) => current.filter((line) => line.id_produk !== id_produk));
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setModalError("");

    try {
      const response = await fetch("/api/pesanan", {
        method: editingOrder ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingOrder
            ? { no_nota: editingOrder.no_nota, items: draftLines }
            : {
                id_pelanggan: customerId,
                id_karyawan: employeeId,
                items: draftLines,
              },
        ),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      await refresh();
      closeModal();
      setView("orders");
      setError("");
    } catch (cause) {
      setModalError(cause instanceof Error ? cause.message : "Pesanan tidak dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOrder() {
    if (!deleteTarget) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/pesanan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ no_nota: deleteTarget.no_nota }),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      await refresh();
      setDeleteTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pesanan tidak dapat dihapus.");
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  }

  const modalOpen = selectedProduct !== null || editingOrder !== null;

  return (
    <main className={styles.page}>
      <Image
        src="/pesanan/ornamen.png"
        alt=""
        width={180}
        height={170}
        className={`${styles.corner} ${styles.cornerTop}`}
        priority
      />
      <Image
        src="/pesanan/ornamen.png"
        alt=""
        width={180}
        height={170}
        className={`${styles.corner} ${styles.cornerBottom}`}
      />

      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Kerupuk Azizah">
          <Image
            src="/pesanan/brand-logo.png"
            alt="Kerupuk Azizah"
            width={280}
            height={100}
            priority
          />
        </Link>
        <nav className={styles.navigation} aria-label="Navigasi utama">
          <Link href="/">Beranda</Link>
          <button
            className={view === "products" ? styles.navActive : ""}
            onClick={() => setView("products")}
            type="button"
          >
            Produk
          </button>
          <button
            className={view === "orders" ? styles.navActive : ""}
            onClick={() => setView("orders")}
            type="button"
          >
            Pesanan
          </button>
          <a href="#hubungi">Hubungi</a>
        </nav>
        <label className={styles.searchBox}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            aria-label="Cari produk atau pesanan"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari Produk . . ."
            value={search}
          />
        </label>
        <div className={styles.profile} aria-label="Profil">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c.6-3.4 3.2-5.3 7-5.3s6.4 1.9 7 5.3" />
          </svg>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>KERUPUK AZIZAH</span>
          <h1>{view === "orders" ? "Pesanan Saya" : "Pilih Kerupuk Favorit"}</h1>
          <p>
            {view === "orders"
              ? "Pantau status pesanan anda di sini. Pastikan pesanan Anda sudah sesuai dan sampai dengan baik."
              : "Renyah, gurih, dan dibuat dengan bahan pilihan untuk menemani setiap momen."}
          </p>
        </div>
        <div className={styles.heroNote}>
          <span>Rasa rumahan</span>
          <strong>Sejak 1998</strong>
        </div>
      </section>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              refresh()
                .then(() => setError(""))
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error ? cause.message : "Data pesanan gagal dimuat.",
                  ),
                )
                .finally(() => setLoading(false));
            }}
          >
            Coba lagi
          </button>
        </div>
      )}

      {view === "products" ? (
        <section className={styles.catalog}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>DARI DAPUR KAMI</span>
              <h2>Katalog Kerupuk</h2>
            </div>
            <p>{visibleProducts.length} pilihan tersedia</p>
          </div>
          {loading ? (
            <div className={styles.emptyState}>Memuat katalog...</div>
          ) : visibleProducts.length ? (
            <div className={styles.productGrid}>
              {visibleProducts.map((product) => (
                <button
                  className={styles.productCard}
                  key={product.id_produk}
                  onClick={() => openCreate(product)}
                  type="button"
                >
                  <ProductImage className={styles.catalogPhoto} product={product} />
                  <span className={styles.productName}>{product.nama_produk}</span>
                  <span className={styles.productPrice}>{money(product.harga)}</span>
                  <span className={styles.cardHint}>Pesan sekarang <span aria-hidden="true">→</span></span>
                </button>
              ))}
            </div>
          ) : error ? (
            <div className={styles.emptyState}>
              Katalog tidak dapat dimuat. Periksa koneksi PostgreSQL dan pilih Coba lagi.
            </div>
          ) : (
            <div className={styles.emptyState}>Produk tidak ditemukan.</div>
          )}
        </section>
      ) : (
        <section className={styles.orderWorkspace}>
          <aside className={styles.sidebar}>
            <div className={styles.sideMenu}>
              <button className={styles.sideItemActive} type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 4.5h14v16H5zM8 8h8M8 12h8M8 16h5" />
                </svg>
                Pesanan Saya
              </button>
              <button className={styles.sideItem} onClick={() => setView("products")} type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16l-1.5 13h-13zM8 7a4 4 0 0 1 8 0" />
                </svg>
                Pilih Produk
              </button>
            </div>
            <div className={styles.sidebarNote}>
              <span>Butuh camilan?</span>
              <p>Pilih kerupuk favoritmu dan pesan langsung dari katalog.</p>
              <button type="button" onClick={() => setView("products")}>
                Lihat produk <span aria-hidden="true">↗</span>
              </button>
            </div>
          </aside>

          <div className={styles.ordersPanel}>
            <div className={styles.panelTop}>
              <div>
                <h2>Riwayat Pesanan</h2>
                <p>Kelola pesanan dan lihat detail belanja Anda.</p>
              </div>
              <button className={styles.primaryButton} onClick={() => setView("products")} type="button">
                <span aria-hidden="true">＋</span> Buat Pesanan
              </button>
            </div>

            <div className={styles.orderTabs}>
              <button
                aria-pressed={!pendingOnly}
                className={!pendingOnly ? styles.tabActive : ""}
                onClick={() => setPendingOnly(false)}
                type="button"
              >
                Semua Pesanan
              </button>
              <button
                aria-pressed={pendingOnly}
                className={pendingOnly ? styles.tabActive : ""}
                onClick={() => setPendingOnly(true)}
                type="button"
              >
                Menunggu Pembayaran
              </button>
            </div>

            {loading ? (
              <div className={styles.emptyState}>Memuat pesanan...</div>
            ) : visibleOrders.length ? (
              <div className={styles.orderList}>
                {visibleOrders.map((order) => (
                  <article className={styles.orderCard} key={order.no_nota}>
                    <div className={styles.orderThumb}>
                      {order.detail_pesanan[0] && (
                        <ProductImage
                          className={styles.orderPhoto}
                          product={order.detail_pesanan[0].produk}
                        />
                      )}
                    </div>
                    <div className={styles.orderInfo}>
                      <div className={styles.orderTitle}>
                        <h3>Pesanan {order.no_nota}</h3>
                        <span
                          className={`${styles.status} ${isPaid(order.status_bayar) ? styles.statusPaid : ""}`}
                        >
                          <span />
                          {order.status_bayar}
                        </span>
                      </div>
                      <p className={styles.dateLine}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="3.5" y="5" width="17" height="16" rx="2" />
                          <path d="M7.5 3v4M16.5 3v4M4 9h16" />
                        </svg>
                        {dateLabel(order.tgl_nota)}
                      </p>
                      <p className={styles.itemLine}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 7h16v13H4zM8 7V4h8v3M8 11h8" />
                        </svg>
                        {order.detail_pesanan.length} Produk
                      </p>
                      <p className={styles.productSummary}>
                        {order.detail_pesanan.map((line) => line.produk.nama_produk).join(", ")}
                      </p>
                    </div>
                    <div className={styles.orderTotal}>
                      <span>Total Pembayaran</span>
                      <strong>{money(order.total_bayar)}</strong>
                      <div className={styles.orderActions}>
                        {!isPaid(order.status_bayar) && (
                          <button
                            className={styles.editButton}
                            onClick={() => openEdit(order)}
                            type="button"
                          >
                            Ubah
                          </button>
                        )}
                        <button
                          className={styles.deleteButton}
                          onClick={() => setDeleteTarget(order)}
                          type="button"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : error ? (
              <div className={styles.emptyState}>
                Pesanan tidak dapat dimuat. Periksa koneksi PostgreSQL dan pilih Coba lagi.
              </div>
            ) : (
              <div className={styles.emptyState}>
                {pendingOnly
                  ? "Tidak ada pesanan yang menunggu pembayaran."
                  : "Belum ada pesanan. Pilih produk untuk membuat pesanan pertama."}
                {!pendingOnly && (
                  <button className={styles.textButton} onClick={() => setView("products")} type="button">
                    Buka katalog <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className={styles.footer} id="hubungi">
        <span>KERUPUK AZIZAH</span>
        <span>Gurihnya bikin rindu.</span>
      </footer>

      {modalOpen && (
        <div className={styles.overlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) closeModal();
        }}>
          <section
            aria-labelledby="order-modal-title"
            aria-modal="true"
            className={`${styles.modal} ${selectedProduct ? styles.createModal : ""}`}
            role="dialog"
          >
            <button
              aria-label="Tutup"
              className={styles.modalClose}
              disabled={busy}
              onClick={closeModal}
              type="button"
            >
              ×
            </button>
            <span className={styles.eyebrow}>{editingOrder ? "PERBARUI PESANAN" : "PESAN KERUPUK"}</span>
            <h2 id="order-modal-title">
              {editingOrder ? "Ubah Detail Pesanan" : "Masukan Jumlah Pesanan"}
            </h2>
            <form onSubmit={submitOrder}>
              <div className={styles.draftList}>
                {draftLines.map((line) => {
                  const product = data.products.find((item) => item.id_produk === line.id_produk);
                  if (!product) {
                    return null;
                  }
                  return (
                    <div className={styles.draftItem} key={line.id_produk}>
                      <ProductImage className={styles.draftPhoto} product={product} />
                      <div className={styles.draftDescription}>
                        <strong>{product.nama_produk}</strong>
                        <span>{money(product.harga)} / bungkus</span>
                      </div>
                      <div className={styles.quantityControl}>
                        <button
                          aria-label={`Kurangi ${product.nama_produk}`}
                          disabled={line.jumlah <= 1}
                          onClick={() => changeQuantity(line.id_produk, line.jumlah - 1)}
                          type="button"
                        >
                          −
                        </button>
                        <input
                          aria-label={`Jumlah ${product.nama_produk}`}
                          min={1}
                          onChange={(event) =>
                            changeQuantity(line.id_produk, Number(event.target.value))
                          }
                          type="number"
                          value={line.jumlah}
                        />
                        <button
                          aria-label={`Tambah ${product.nama_produk}`}
                          onClick={() => changeQuantity(line.id_produk, line.jumlah + 1)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      {draftLines.length > 1 && (
                        <button
                          aria-label={`Hapus ${product.nama_produk} dari pesanan`}
                          className={styles.removeLine}
                          onClick={() => removeProductLine(line.id_produk)}
                          type="button"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {data.products.some(
                (product) => !draftLines.some((line) => line.id_produk === product.id_produk),
              ) && (
                <div className={styles.addProductRow}>
                  <select
                    aria-label="Pilih produk tambahan"
                    onChange={(event) => setExtraProduct(event.target.value)}
                    value={extraProduct}
                  >
                    <option value="">Tambah produk</option>
                    {data.products
                      .filter((product) => !draftLines.some((line) => line.id_produk === product.id_produk))
                      .map((product) => (
                        <option key={product.id_produk} value={product.id_produk}>
                          {product.nama_produk}
                        </option>
                      ))}
                  </select>
                  <button onClick={addProductLine} type="button" disabled={!extraProduct}>
                    Tambah
                  </button>
                </div>
              )}

              {!editingOrder && (
                <div className={styles.identityFields}>
                  <label>
                    Pelanggan
                    <select
                      onChange={(event) => setCustomerId(event.target.value)}
                      required
                      value={customerId}
                    >
                      <option value="">Pilih pelanggan</option>
                      {data.customers.map((customer) => (
                        <option key={customer.id_pelanggan} value={customer.id_pelanggan}>
                          {customer.nama_pelanggan}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Petugas
                    <select
                      onChange={(event) => setEmployeeId(event.target.value)}
                      required
                      value={employeeId}
                    >
                      <option value="">Pilih petugas</option>
                      {data.employees.map((employee) => (
                        <option key={employee.id_karyawan} value={employee.id_karyawan}>
                          {employee.nama_karyawan}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div className={styles.modalTotal}>
                <span>Subtotal Pesanan</span>
                <strong>{money(draftTotal)}</strong>
              </div>
              {modalError && <p className={styles.modalError} role="alert">{modalError}</p>}
              <div className={styles.modalActions}>
                <button className={styles.primaryButton} disabled={busy || draftLines.length === 0} type="submit">
                  {busy ? "Menyimpan..." : editingOrder ? "Simpan Perubahan" : "Pesan"}
                </button>
                <button className={styles.secondaryButton} disabled={busy} onClick={closeModal} type="button">
                  Kembali
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className={styles.overlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) setDeleteTarget(null);
        }}>
          <section
            aria-labelledby="delete-modal-title"
            aria-modal="true"
            className={`${styles.modal} ${styles.confirmModal}`}
            role="alertdialog"
          >
            <div className={styles.warningIcon} aria-hidden="true">!</div>
            <span className={styles.eyebrow}>KONFIRMASI</span>
            <h2 id="delete-modal-title">Hapus pesanan ini?</h2>
            <p>
              Pesanan <strong>{deleteTarget.no_nota}</strong> beserta seluruh detail produknya
              akan dihapus permanen.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.dangerButton} disabled={busy} onClick={deleteOrder} type="button">
                {busy ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button
                className={styles.secondaryButton}
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                Kembali
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
