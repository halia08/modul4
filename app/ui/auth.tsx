"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import styles from "./auth.module.css";

type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle: ReactNode;
};

type ApiResult = {
  error?: string;
  redirectTo?: string;
  postalCodes?: PostalCode[];
};

type PostalCode = {
  kode_pos: string;
  kelurahan: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readApiResult(response: Response): Promise<ApiResult> {
  const body: unknown = await response.json();
  if (!isRecord(body)) {
    throw new Error("Respons server tidak valid.");
  }

  return {
    error: typeof body.error === "string" ? body.error : undefined,
    redirectTo:
      typeof body.redirectTo === "string" ? body.redirectTo : undefined,
    postalCodes: Array.isArray(body.postalCodes)
      ? body.postalCodes.filter(
          (item): item is PostalCode =>
            isRecord(item) &&
            typeof item.kode_pos === "string" &&
            typeof item.kelurahan === "string" &&
            typeof item.kecamatan === "string" &&
            typeof item.kota === "string" &&
            typeof item.provinsi === "string",
        )
      : undefined,
  };
}

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
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
        className={`${styles.ornament} ${styles.ornamentBottom}`}
        src="/pesanan/ornamen.png"
        alt=""
        aria-hidden="true"
        width={179}
        height={170}
      />
      <Image
        className={styles.brand}
        src="/pesanan/brand-logo.png"
        alt="Kerupuk Azizah — Pusat Oleh-Oleh Khas Minangkabau"
        width={657}
        height={219}
        priority
      />
      <Link className={styles.homeLink} href="/" aria-label="Kembali ke beranda">
        <Image
          src="/pesanan/home-icon.svg"
          alt=""
          aria-hidden="true"
          width={59}
          height={56}
        />
      </Link>
      <section className={styles.card}>
        <div className={styles.cardContent}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.subtitle}>{subtitle}</div>
          {children}
        </div>
      </section>
    </main>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: formData.get("identifier"),
          password: formData.get("password"),
        }),
      });
      const result = await readApiResult(response);

      if (!response.ok || !result.redirectTo) {
        setError(result.error ?? "Login tidak berhasil. Silakan coba kembali.");
        return;
      }

      router.push(result.redirectTo);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Login tidak dapat diproses saat ini.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.visuallyHidden} htmlFor="login-identifier">
        Username atau email
      </label>
      <input
        className={styles.input}
        id="login-identifier"
        name="identifier"
        type="text"
        placeholder="Username"
        autoComplete="username"
        maxLength={100}
        required
      />
      <label className={styles.visuallyHidden} htmlFor="login-password">
        Password
      </label>
      <input
        className={styles.input}
        id="login-password"
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        maxLength={128}
        required
      />
      <Link className={styles.forgotLink} href="/reset-password">
        Lupa Password?
      </Link>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button
        className={styles.primaryButton}
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Memproses..." : "Konfirmasi"}
      </button>
      <Link className={styles.secondaryButton} href="/register">
        Belum Punya Akun
      </Link>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: formData.get("identifier"),
          password: formData.get("password"),
          confirmation: formData.get("confirmation"),
        }),
      });
      const result = await readApiResult(response);

      if (!response.ok || !result.redirectTo) {
        setError(result.error ?? "Pendaftaran tidak berhasil.");
        return;
      }

      router.push(result.redirectTo);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Pendaftaran tidak dapat diproses saat ini.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={`${styles.form} ${styles.registerForm}`} onSubmit={submit}>
      <label className={styles.visuallyHidden} htmlFor="register-identifier">
        Username berupa alamat email
      </label>
      <input
        className={styles.input}
        id="register-identifier"
        name="identifier"
        type="email"
        placeholder="Username"
        autoComplete="email"
        maxLength={50}
        required
      />
      <label className={styles.visuallyHidden} htmlFor="register-password">
        Password
      </label>
      <input
        className={styles.input}
        id="register-password"
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
      />
      <label className={styles.visuallyHidden} htmlFor="register-confirmation">
        Konfirmasi password
      </label>
      <input
        className={styles.input}
        id="register-confirmation"
        name="confirmation"
        type="password"
        placeholder="Konfirmasi Password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
      />
      <p className={styles.hint}>
        Gunakan alamat email aktif sebagai username. Profil pelanggan dilengkapi
        setelah pendaftaran.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button
        className={`${styles.primaryButton} ${styles.animatedButton}`}
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Memproses..." : "Daftar"}
      </button>
      <Link className={styles.secondaryButton} href="/login">
        Sudah Punya Akun
      </Link>
    </form>
  );
}

export function ProfileForm() {
  const router = useRouter();
  const [postalCodes, setPostalCodes] = useState<PostalCode[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/profile", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await readApiResult(response);
        if (!response.ok) {
          throw new Error(result.error ?? "Data alamat tidak dapat dimuat.");
        }
        setPostalCodes(result.postalCodes ?? []);
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
            : "Data alamat tidak dapat dimuat saat ini.",
        );
      });

    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          phone: formData.get("phone"),
          address: formData.get("address"),
          gender: formData.get("gender"),
          birthDate: formData.get("birthDate"),
          postalCode: formData.get("postalCode"),
        }),
      });
      const result = await readApiResult(response);

      if (!response.ok || !result.redirectTo) {
        setError(result.error ?? "Profil tidak dapat disimpan.");
        return;
      }

      router.push(result.redirectTo);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Profil tidak dapat disimpan saat ini.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className={`${styles.form} ${styles.profileForm}`}
      onSubmit={submit}
    >
      <label className={styles.visuallyHidden} htmlFor="profile-name">
        Nama lengkap
      </label>
      <input
        className={styles.input}
        id="profile-name"
        name="name"
        placeholder="Nama Lengkap"
        autoComplete="name"
        maxLength={100}
        required
      />
      <label className={styles.visuallyHidden} htmlFor="profile-phone">
        Nomor telepon
      </label>
      <input
        className={styles.input}
        id="profile-phone"
        name="phone"
        placeholder="Nomor Telepon"
        type="tel"
        autoComplete="tel"
        maxLength={15}
        required
      />
      <label className={styles.visuallyHidden} htmlFor="profile-address">
        Alamat
      </label>
      <input
        className={styles.input}
        id="profile-address"
        name="address"
        placeholder="Alamat"
        autoComplete="street-address"
        maxLength={100}
        required
      />
      <div className={styles.fieldRow}>
        <label className={styles.visuallyHidden} htmlFor="profile-gender">
          Jenis kelamin
        </label>
        <select
          className={styles.input}
          id="profile-gender"
          name="gender"
          defaultValue=""
        >
          <option value="">Jenis Kelamin (opsional)</option>
          <option value="Laki-Laki">Laki-Laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>
        <label className={styles.visuallyHidden} htmlFor="profile-birth-date">
          Tanggal lahir
        </label>
        <input
          className={styles.input}
          id="profile-birth-date"
          name="birthDate"
          type="date"
          aria-label="Tanggal lahir (opsional)"
        />
      </div>
      <label className={styles.visuallyHidden} htmlFor="profile-postal-code">
        Kode pos
      </label>
      <select
        className={styles.input}
        id="profile-postal-code"
        name="postalCode"
        defaultValue=""
        required
        disabled={postalCodes.length === 0}
      >
        <option value="">Pilih Kode Pos</option>
        {postalCodes.map((item) => (
          <option key={item.kode_pos} value={item.kode_pos}>
            {item.kode_pos} · {item.kelurahan}, {item.kecamatan},{" "}
            {item.kota}
          </option>
        ))}
      </select>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button
        className={styles.primaryButton}
        type="submit"
        disabled={isSubmitting || postalCodes.length === 0}
      >
        {isSubmitting ? "Menyimpan..." : "Simpan Profil"}
      </button>
    </form>
  );
}
