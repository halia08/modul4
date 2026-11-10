"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/auth";
import styles from "./management-shell.module.css";

type MenuItem = { label: string; href: string };

const roleMenus: Record<UserRole, MenuItem[]> = {
  Admin: [
    { label: "Beranda", href: "/admin" },
    { label: "Produk", href: "/admin/produk" },
    { label: "Pesanan", href: "/admin/pesanan" },
    { label: "Riwayat Transaksi", href: "/admin/transaksi" },
    { label: "Layanan Pelanggan", href: "/admin/feedback" },
    { label: "Laporan", href: "/admin/laporan" },
    { label: "Pengguna", href: "/admin/pengguna" },
  ],
  Owner: [
    { label: "Beranda", href: "/owner" },
    { label: "Dashboard Penjualan", href: "/owner/pembayaran" },
    { label: "Informasi Stok", href: "/owner/produksi" },
    { label: "Draft Laporan", href: "/owner/laporan?tab=draft" },
    { label: "Laporan", href: "/owner/laporan" },
  ],
  Karyawan: [
    { label: "Beranda", href: "/karyawan" },
    { label: "Tugas Produksi", href: "/karyawan/produksi" },
    { label: "Bahan Baku", href: "/karyawan/bahan-baku" },
    { label: "Proses Produksi", href: "/karyawan/proses-produksi" },
    { label: "Hasil Produksi", href: "/karyawan/hasil-produksi" },
    { label: "Layanan Pelanggan", href: "/karyawan/feedback" },
  ],
  Pelanggan: [],
};

type ManagementShellProps = {
  role: Exclude<UserRole, "Pelanggan">;
  identity: string;
  children: ReactNode;
};

export default function ManagementShell({
  role,
  identity,
  children,
}: ManagementShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState("");

  async function logout() {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Sesi tidak dapat diakhiri.");
      }
      router.push("/login");
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Logout tidak berhasil.",
      );
    }
  }

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>KA</span>
          <span>
            <strong>Kerupuk Azizah</strong>
            <small>Panel {role}</small>
          </span>
        </div>
        <p className={styles.menuTitle}>MENU</p>
        <nav className={styles.navigation} aria-label="Menu dashboard">
          {roleMenus[role].map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== `/${role.toLowerCase()}` &&
                pathname.startsWith(item.href));
            return (
              <Link
                className={`${styles.navLink} ${active ? styles.active : ""}`}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
              >
                <span className={styles.navGlyph} aria-hidden="true">
                  {item.label === "Beranda"
                    ? "⌂"
                    : item.label.includes("Produk") || item.label.includes("Stok")
                      ? "◇"
                      : item.label.includes("Pesanan") ||
                          item.label.includes("Produksi")
                        ? "▣"
                        : item.label.includes("Laporan")
                          ? "▤"
                          : item.label.includes("Transaksi") ||
                              item.label.includes("Penjualan")
                            ? "◷"
                            : "✉"}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.profile}>
          <span className={styles.avatar}>
            {identity.slice(0, 1).toUpperCase()}
          </span>
          <span className={styles.profileText}>
            <strong>{identity}</strong>
            <small>
              {role === "Owner"
                ? "Pemilik usaha"
                : role === "Karyawan"
                  ? "Pengelola produksi"
                  : "Pengelola usaha"}
            </small>
          </span>
        </div>
        <button className={styles.logout} type="button" onClick={logout}>
          <span aria-hidden="true">↪</span>
          Keluar
        </button>
        {logoutError && (
          <p className={styles.logoutError} role="alert">
            {logoutError}
          </p>
        )}
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
