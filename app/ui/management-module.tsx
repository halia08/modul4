"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { UserRole } from "@/lib/auth";
import styles from "./management-module.module.css";

type Mode =
  | "products"
  | "orders"
  | "payments"
  | "reports"
  | "feedback"
  | "production"
  | "users";
type RecordRow = Record<string, unknown>;
type Category = { id_kategori: string; nama_kategori: string };
type ProductOption = { id: string; name: string };

function isRecord(value: unknown): value is RecordRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rows(value: unknown): RecordRow[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function formatCurrency(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function modeFor(section: string): Mode {
  if (section.includes("produk")) return "products";
  if (section.includes("pesanan")) return "orders";
  if (section.includes("transaksi") || section.includes("pembayaran")) {
    return "payments";
  }
  if (section.includes("feedback")) return "feedback";
  if (section.includes("laporan")) return "reports";
  if (section.includes("pengguna")) return "users";
  return "production";
}

const headings: Record<Mode, string> = {
  products: "Manajemen Produk",
  orders: "Manajemen Pesanan",
  payments: "Transaksi dan Pembayaran",
  reports: "Laporan",
  feedback: "Layanan Pelanggan",
  production: "Pengelolaan Produksi",
  users: "Manajemen Pengguna",
};

const endpoints: Record<Mode, string> = {
  products: "/api/produk",
  orders: "/api/pesanan",
  payments: "/api/pembayaran",
  reports: "/api/laporan",
  feedback: "/api/feedback",
  production: "/api/produksi",
  users: "/api/pengguna",
};

type ManagementModuleProps = {
  role: Exclude<UserRole, "Pelanggan">;
  section: string;
};

export default function ManagementModule({
  role,
  section,
}: ManagementModuleProps) {
  const mode = modeFor(section);
  const title = section === "transaksi" ? "Riwayat Transaksi" : headings[mode];
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [inventory, setInventory] = useState<RecordRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [metrics, setMetrics] = useState<RecordRow | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingProduct, setEditingProduct] = useState<RecordRow | null>(null);

  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [employeeRole, setEmployeeRole] = useState("Pelanggan");
  const [productionProduct, setProductionProduct] = useState("");
  const [productionQuantity, setProductionQuantity] = useState("1");
  const [productionDate, setProductionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reportType, setReportType] = useState("Penjualan");
  const [reportFrom, setReportFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reportTo, setReportTo] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoints[mode], { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body)) {
        throw new Error(
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : "Data tidak dapat dimuat.",
        );
      }

      const dataKey = mode === "orders" ? "orders" : "records";
      setRecords(rows(body[dataKey]));
      setInventory(rows(body.inventory));
      setCategories(
        Array.isArray(body.categories)
          ? body.categories.filter(
              (item): item is Category =>
                isRecord(item) &&
                typeof item.id_kategori === "string" &&
                typeof item.nama_kategori === "string",
            )
          : [],
      );
      setMetrics(isRecord(body.metrics) ? body.metrics : null);
      setNotice("");

      if (mode === "production") {
        const catalogResponse = await fetch("/api/katalog", {
          cache: "no-store",
        });
        const catalog: unknown = await catalogResponse.json();
        if (catalogResponse.ok && isRecord(catalog)) {
          setProductOptions(
            rows(catalog.products)
              .filter(
                (product) =>
                  typeof product.id === "string" &&
                  typeof product.name === "string",
              )
              .map((product) => ({
                id: product.id as string,
                name: product.name as string,
              })),
          );
        }
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Data tidak dapat dimuat saat ini.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const visibleRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) =>
      Object.values(record).some(
        (value) => typeof value === "string" && value.toLowerCase().includes(needle),
      ),
    );
  }, [query, records]);

  async function mutate(
    url: string,
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    payload?: Record<string, unknown>,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(url, {
        method,
        ...(payload
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          : {}),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : "Perubahan tidak dapat disimpan.",
        );
      }
      setNotice("Perubahan berhasil disimpan.");
      await loadData();
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Perubahan tidak dapat disimpan saat ini.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: productName,
      price: Number(productPrice),
      categoryId,
    };
    const url = editingProduct
      ? `/api/produk/${encodeURIComponent(text(editingProduct.id, ""))}`
      : endpoints.products;
    const method = editingProduct ? "PATCH" : "POST";
    if (await mutate(url, method, payload)) {
      setProductName("");
      setProductPrice("");
      setCategoryId("");
      setEditingProduct(null);
    }
  }

  function editProduct(record: RecordRow) {
    setEditingProduct(record);
    setProductName(text(record.name, ""));
    setProductPrice(String(record.price ?? ""));
    setCategoryId(text(record.categoryId, ""));
  }

  function submitProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productionProduct) {
      setError("Pilih produk untuk dicatat sebagai hasil produksi.");
      return;
    }
    void mutate(endpoints.production, "POST", {
      date: productionDate,
      items: [
        {
          id_produk: productionProduct,
          jumlah: Number(productionQuantity),
        },
      ],
    });
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate(endpoints.reports, "POST", {
      type: reportType,
      from: reportFrom,
      to: reportTo,
    });
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, unknown> = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: employeeRole,
    };
    if (employeeRole === "Karyawan") {
      payload.employee = {
        name: formData.get("employeeName"),
        title: formData.get("employeeTitle"),
        phone: formData.get("employeePhone"),
        postalCode: formData.get("postalCode"),
      };
    }
    if (await mutate(endpoints.users, "POST", payload)) {
      form.reset();
      setEmployeeRole("Pelanggan");
    }
  }

  const canManageOrders = role === "Admin" || role === "Owner";

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>KERUPUK AZIZAH · {role.toUpperCase()}</p>
          <h1>{title}</h1>
          <p className={styles.subtitle}>
            Kelola informasi operasional yang tersimpan di sistem.
          </p>
        </div>
        <button
          className={styles.refresh}
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
        >
          {loading ? "Memuat..." : "Muat ulang"}
        </button>
      </header>

      {metrics && mode === "payments" && (
        <div className={styles.metrics}>
          <article>
            <span>Total pembayaran lunas</span>
            <strong>{formatCurrency(metrics.totalPaid)}</strong>
          </article>
          <article>
            <span>Jumlah pesanan</span>
            <strong>{text(String(metrics.totalOrders ?? 0))}</strong>
          </article>
          <article>
            <span>Menunggu konfirmasi</span>
            <strong>{text(String(metrics.awaitingConfirmation ?? 0))}</strong>
          </article>
        </div>
      )}

      {mode === "production" && (
        <p className={styles.note}>
          Stok tersedia merupakan perkiraan produksi tercatat dikurangi pesanan;
          database belum menyimpan saldo awal stok.
        </p>
      )}

      {(mode === "products" ||
        mode === "reports" ||
        mode === "production" ||
        mode === "users") && (
        <div className={styles.formCard}>
          <h2>
            {mode === "products"
              ? editingProduct
                ? "Ubah Produk"
                : "Tambah Produk"
              : mode === "reports"
                ? "Buat Laporan"
                : mode === "production"
                  ? "Catat Hasil Produksi"
                  : "Tambah Pengguna"}
          </h2>

          {mode === "products" && (
            <form className={styles.formGrid} onSubmit={submitProduct}>
              <label>
                Nama produk
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                />
              </label>
              <label>
                Harga (Rp)
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={productPrice}
                  onChange={(event) => setProductPrice(event.target.value)}
                />
              </label>
              <label>
                Kategori
                <select
                  required
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Pilih kategori</option>
                  {categories.map((category) => (
                    <option key={category.id_kategori} value={category.id_kategori}>
                      {category.nama_kategori}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.formActions}>
                <button className={styles.primaryButton} type="submit" disabled={busy}>
                  {editingProduct ? "Simpan Perubahan" : "Simpan Produk"}
                </button>
                {editingProduct && (
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setProductName("");
                      setProductPrice("");
                      setCategoryId("");
                    }}
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          )}

          {mode === "reports" && (
            <form className={styles.formGrid} onSubmit={submitReport}>
              <label>
                Jenis laporan
                <select
                  value={reportType}
                  onChange={(event) => setReportType(event.target.value)}
                >
                  <option value="Penjualan">Penjualan</option>
                  <option value="Pesanan">Pesanan</option>
                </select>
              </label>
              <label>
                Dari tanggal
                <input
                  type="date"
                  required
                  value={reportFrom}
                  onChange={(event) => setReportFrom(event.target.value)}
                />
              </label>
              <label>
                Sampai tanggal
                <input
                  type="date"
                  required
                  value={reportTo}
                  onChange={(event) => setReportTo(event.target.value)}
                />
              </label>
              <div className={styles.formActions}>
                <button className={styles.primaryButton} type="submit" disabled={busy}>
                  Buat Laporan
                </button>
              </div>
            </form>
          )}

          {mode === "production" && (
            <form className={styles.formGrid} onSubmit={submitProduction}>
              <label>
                Produk
                <select
                  required
                  value={productionProduct}
                  onChange={(event) => setProductionProduct(event.target.value)}
                >
                  <option value="">Pilih produk</option>
                  {productOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Jumlah produksi
                <input
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  required
                  value={productionQuantity}
                  onChange={(event) => setProductionQuantity(event.target.value)}
                />
              </label>
              <label>
                Tanggal produksi
                <input
                  type="date"
                  required
                  value={productionDate}
                  onChange={(event) => setProductionDate(event.target.value)}
                />
              </label>
              <div className={styles.formActions}>
                <button className={styles.primaryButton} type="submit" disabled={busy}>
                  Simpan Hasil Produksi
                </button>
              </div>
            </form>
          )}

          {mode === "users" && (
            <form className={styles.formGrid} onSubmit={submitUser}>
              <label>
                Username
                <input name="username" required minLength={3} maxLength={50} />
              </label>
              <label>
                Email
                <input name="email" type="email" required maxLength={100} />
              </label>
              <label>
                Kata sandi sementara
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Role
                <select
                  value={employeeRole}
                  onChange={(event) => setEmployeeRole(event.target.value)}
                >
                  <option value="Pelanggan">Pelanggan</option>
                  <option value="Karyawan">Karyawan</option>
                  {role === "Owner" && <option value="Admin">Admin</option>}
                </select>
              </label>
              {employeeRole === "Karyawan" && (
                <>
                  <label>
                    Nama karyawan
                    <input
                      name="employeeName"
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Jabatan
                    <input
                      name="employeeTitle"
                      required
                      minLength={2}
                      maxLength={50}
                    />
                  </label>
                  <label>
                    Nomor telepon
                    <input
                      name="employeePhone"
                      required
                      inputMode="tel"
                      minLength={8}
                      maxLength={15}
                    />
                  </label>
                  <label>
                    Kode pos
                    <input name="postalCode" required maxLength={10} />
                  </label>
                </>
              )}
              <div className={styles.formActions}>
                <button className={styles.primaryButton} type="submit" disabled={busy}>
                  Buat Akun
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Cari data"
            placeholder="Cari data..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className={styles.resultCount}>{visibleRecords.length} data</span>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p className={styles.loading} role="status">
          Memuat data...
        </p>
      ) : (
        <>
          {mode === "production" && inventory.length > 0 && (
            <section className={styles.inventory}>
              <h2>Perkiraan Stok Produk</h2>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Diproduksi</th>
                      <th>Dipesan</th>
                      <th>Perkiraan tersedia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <tr key={text(item.id)}>
                        <td>{text(item.name)}</td>
                        <td>{text(String(item.produced ?? 0))}</td>
                        <td>{text(String(item.ordered ?? 0))}</td>
                        <td>{text(String(item.estimatedAvailable ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {visibleRecords.length === 0 ? (
            <p className={styles.empty}>
              {records.length === 0
                ? "Belum ada data untuk ditampilkan."
                : "Tidak ada data yang cocok dengan pencarian."}
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    {mode === "products" && (
                      <>
                        <th>Produk</th>
                        <th>Kategori</th>
                        <th>Harga</th>
                        <th>Aksi</th>
                      </>
                    )}
                    {(mode === "orders" || mode === "payments") && (
                      <>
                        <th>No. Pesanan</th>
                        <th>Pelanggan</th>
                        <th>Tanggal</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Pembayaran</th>
                      </>
                    )}
                    {mode === "reports" && (
                      <>
                        <th>Jenis Laporan</th>
                        <th>Total</th>
                        <th>Dibuat oleh</th>
                        <th>Aksi</th>
                      </>
                    )}
                    {mode === "feedback" && (
                      <>
                        <th>Pelanggan</th>
                        <th>Pesanan</th>
                        <th>Tanggal</th>
                        <th>Ulasan dan tanggapan</th>
                      </>
                    )}
                    {mode === "production" && (
                      <>
                        <th>No. Produksi</th>
                        <th>Tanggal</th>
                        <th>Karyawan</th>
                        <th>Hasil</th>
                        <th>Peringatan stok</th>
                      </>
                    )}
                    {mode === "users" && (
                      <>
                        <th>Pengguna</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((record, index) => {
                    const id = text(record.id, String(index));
                    return (
                      <tr key={id}>
                        {mode === "products" && (
                          <>
                            <td>
                              <strong>{text(record.name)}</strong>
                              <small>{id}</small>
                            </td>
                            <td>{text(record.category)}</td>
                            <td>{formatCurrency(record.price)}</td>
                            <td className={styles.actions}>
                              <button
                                type="button"
                                onClick={() => editProduct(record)}
                              >
                                Ubah
                              </button>
                              <button
                                type="button"
                                className={styles.dangerAction}
                                disabled={busy}
                                onClick={() => {
                                  if (window.confirm(`Hapus produk ${text(record.name)}?`)) {
                                    void mutate(
                                      `/api/produk/${encodeURIComponent(id)}`,
                                      "DELETE",
                                    );
                                  }
                                }}
                              >
                                Hapus
                              </button>
                            </td>
                          </>
                        )}
                        {(mode === "orders" || mode === "payments") && (
                          <>
                            <td>
                              <strong>{id}</strong>
                              {mode === "payments" && (
                                <small>{text(record.method)}</small>
                              )}
                            </td>
                            <td>{text(record.customer)}</td>
                            <td>{text(record.date)}</td>
                            <td>{formatCurrency(record.total)}</td>
                            <td>
                              <span className={styles.status}>
                                {text(record.status)}
                              </span>
                            </td>
                            <td className={styles.actions}>
                              <select
                                aria-label={`Status pembayaran ${id}`}
                                defaultValue={text(record.confirmation, "Menunggu")}
                                disabled={!canManageOrders || busy}
                                onChange={(event) =>
                                  void mutate(endpoints.payments, "PATCH", {
                                    id,
                                    confirmation: event.target.value,
                                  })
                                }
                              >
                                <option value="Menunggu">Menunggu</option>
                                <option value="Terkonfirmasi">Terkonfirmasi</option>
                                <option value="Ditolak">Ditolak</option>
                              </select>
                              {canManageOrders && (
                                <select
                                  aria-label={`Ubah status pesanan ${id}`}
                                  defaultValue={text(record.status, "Menunggu")}
                                  disabled={busy}
                                  onChange={(event) =>
                                    void mutate(
                                      mode === "payments"
                                        ? endpoints.payments
                                        : `/api/pesanan/${encodeURIComponent(id)}`,
                                      mode === "payments" ? "PATCH" : "PATCH",
                                      mode === "payments"
                                        ? { id, status: event.target.value }
                                        : { status: event.target.value },
                                    )
                                  }
                                >
                                  <option value="Menunggu">Menunggu</option>
                                  <option value="Lunas">Lunas</option>
                                  <option value="Dibatalkan">Dibatalkan</option>
                                </select>
                              )}
                            </td>
                          </>
                        )}
                        {mode === "reports" && (
                          <>
                            <td>
                              <strong>{text(record.type)}</strong>
                              <small>{id}</small>
                            </td>
                            <td>{formatCurrency(record.total)}</td>
                            <td>{text(record.author)}</td>
                            <td>
                              <button
                                className={styles.dangerAction}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void mutate(
                                    `/api/laporan?id=${encodeURIComponent(id)}`,
                                    "DELETE",
                                  )
                                }
                              >
                                Hapus
                              </button>
                            </td>
                          </>
                        )}
                        {mode === "feedback" && (
                          <>
                            <td>{text(record.customer)}</td>
                            <td>{text(record.orderId)}</td>
                            <td>{text(record.date)}</td>
                            <td className={styles.feedbackCell}>
                              <p>{text(record.message)}</p>
                              {rows(record.replies).map((reply, replyIndex) => (
                                <p className={styles.reply} key={replyIndex}>
                                  <strong>{text(reply.employee)}:</strong>{" "}
                                  {text(reply.message)}
                                </p>
                              ))}
                              {role === "Karyawan" && (
                                <form
                                  className={styles.inlineReply}
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const form = event.currentTarget;
                                    const message = new FormData(form).get("message");
                                    if (typeof message === "string" && message.trim()) {
                                      void mutate(endpoints.feedback, "PATCH", {
                                        id,
                                        message,
                                      });
                                      form.reset();
                                    }
                                  }}
                                >
                                  <input
                                    name="message"
                                    aria-label="Tulis tanggapan"
                                    placeholder="Tulis tanggapan..."
                                    required
                                    minLength={3}
                                    maxLength={255}
                                  />
                                  <button type="submit" disabled={busy}>
                                    Balas
                                  </button>
                                </form>
                              )}
                            </td>
                          </>
                        )}
                        {mode === "production" && (
                          <>
                            <td>{id}</td>
                            <td>{text(record.date)}</td>
                            <td>{text(record.employee)}</td>
                            <td>
                              {rows(record.items)
                                .map(
                                  (item) =>
                                    `${text(item.product)} × ${text(String(item.quantity))}`,
                                )
                                .join(", ") || "—"}
                            </td>
                            <td>
                              {(role === "Admin" || role === "Owner") && (
                                <select
                                  aria-label={`Peringatan stok produksi ${id}`}
                                  defaultValue={text(record.stockNotice, "")}
                                  disabled={busy}
                                  onChange={(event) =>
                                    void mutate(
                                      `/api/produksi/${encodeURIComponent(id)}`,
                                      "PATCH",
                                      { stockNotice: event.target.value },
                                    )
                                  }
                                >
                                  <option value="">Tanpa catatan</option>
                                  <option value="Perlu ditinjau">Perlu ditinjau</option>
                                  <option value="Sudah ditinjau">Sudah ditinjau</option>
                                </select>
                              )}
                              {role === "Karyawan" && text(record.stockNotice)}
                            </td>
                          </>
                        )}
                        {mode === "users" && (
                          <>
                            <td>
                              <strong>{text(record.displayName)}</strong>
                              <small>{text(record.username)}</small>
                            </td>
                            <td>{text(record.email)}</td>
                            <td>{text(record.role)}</td>
                            <td>
                              <span className={styles.status}>
                                {text(record.status)}
                              </span>
                            </td>
                            <td>
                              <button
                                className={
                                  text(record.status).toLowerCase() === "aktif"
                                    ? styles.dangerAction
                                    : styles.actionButton
                                }
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void mutate(endpoints.users, "PATCH", {
                                    id,
                                    status:
                                      text(record.status).toLowerCase() === "aktif"
                                        ? "Nonaktif"
                                        : "Aktif",
                                  })
                                }
                              >
                                {text(record.status).toLowerCase() === "aktif"
                                  ? "Nonaktifkan"
                                  : "Aktifkan"}
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
