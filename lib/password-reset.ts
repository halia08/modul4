import { createHmac, timingSafeEqual } from "node:crypto";
import { getPasswordFingerprint } from "@/lib/auth";

const resetLifetimeSeconds = 15 * 60;

export type PasswordResetClaims = {
  userId: string;
  email: string;
  passwordFingerprint: string;
  expiresAt: number;
};

function getResetSecret(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes.");
  }
  return Buffer.from(secret, "utf8");
}

function sign(payload: string): Buffer {
  return createHmac("sha256", getResetSecret())
    .update(`password-reset:${payload}`)
    .digest();
}

export function createPasswordResetToken(
  userId: string,
  email: string,
  passwordHash: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const claims: PasswordResetClaims = {
    userId,
    email: email.toLowerCase(),
    passwordFingerprint: getPasswordFingerprint(passwordHash),
    expiresAt: now + resetLifetimeSeconds,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload).toString("base64url")}`;
}

export function verifyPasswordResetToken(
  token: string,
  now = Math.floor(Date.now() / 1000),
): PasswordResetClaims | null {
  if (!token || token.length > 2048) return null;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  try {
    const expected = sign(payload);
    const supplied = Buffer.from(signature, "base64url");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return null;
    }

    const value: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      typeof value !== "object" ||
      value === null ||
      !("userId" in value) ||
      !("email" in value) ||
      !("passwordFingerprint" in value) ||
      !("expiresAt" in value) ||
      typeof value.userId !== "string" ||
      typeof value.email !== "string" ||
      typeof value.passwordFingerprint !== "string" ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= now
    ) {
      return null;
    }

    return {
      userId: value.userId,
      email: value.email,
      passwordFingerprint: value.passwordFingerprint,
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}