"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./auth.module.css";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type PasswordResetFormProps = { token?: string };

export default function PasswordResetForm({ token }: PasswordResetFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const endpoint = token
      ? "/api/auth/password-reset/complete"
      : "/api/auth/password-reset/request";
    const payload = token
      ? {
          token,
          password: formData.get("password"),
          confirmation: formData.get("confirmation"),
        }
      : { email: formData.get("email") };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body)) {
        throw new Error(
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : "Permintaan reset tidak dapat diproses.",
        );
      }

      if (token) {
        router.push("/login?reset=success");
        return;
      }
      setMessage(
        typeof body.message === "string"
          ? body.message
          : "Periksa email Anda untuk tautan reset.",
      );
      form.reset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Permintaan reset tidak dapat diproses saat ini.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {token ? (
        <>
          <label className={styles.visuallyHidden} htmlFor="reset-password">
            Kata sandi baru
          </label>
          <input
            className={styles.input}
            id="reset-password"
            name="password"
            type="password"
            placeholder="Password Baru"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
          <label
            className={styles.visuallyHidden}
            htmlFor="reset-confirmation"
          >
            Konfirmasi kata sandi baru
          </label>
          <input
            className={styles.input}
            id="reset-confirmation"
            name="confirmation"
            type="password"
            placeholder="Konfirmasi Password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </>
      ) : (
        <>
          <label className={styles.visuallyHidden} htmlFor="reset-email">
            Email akun
          </label>
          <input
            className={styles.input}
            id="reset-email"
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            maxLength={100}
            required
          />
          <p className={styles.hint}>
            Tautan reset akan berlaku selama 15 menit. Jika belum menerima
            email, hubungi pengelola untuk bantuan.
          </p>
        </>
      )}
      {message && (
        <p className={styles.hint} role="status">
          {message}
        </p>
      )}
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
        {isSubmitting
          ? "Memproses..."
          : token
            ? "Simpan Password Baru"
            : "Kirim Tautan Reset"}
      </button>
      <Link className={styles.secondaryButton} href="/login">
        Kembali ke Login
      </Link>
    </form>
  );
}
