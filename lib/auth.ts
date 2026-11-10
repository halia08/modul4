import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

export const sessionCookieName = "ka_session";
export const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

export type UserRole = "Admin" | "Owner" | "Karyawan" | "Pelanggan";

export type Session = {
  userId: string;
  role: UserRole;
  passwordFingerprint: string;
  expiresAt: number;
};

const passwordKeyLength = 32;
const scryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, passwordKeyLength, scryptOptions, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);

  return [
    "",
    "scrypt",
    String(scryptOptions.N),
    String(scryptOptions.r),
    String(scryptOptions.p),
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedPassword: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  const parts = storedPassword.split("$");

  if (
    parts.length === 7 &&
    parts[1] === "scrypt" &&
    parts[2] === String(scryptOptions.N) &&
    parts[3] === String(scryptOptions.r) &&
    parts[4] === String(scryptOptions.p)
  ) {
    const salt = Buffer.from(parts[5], "base64url");
    const expectedKey = Buffer.from(parts[6], "base64url");

    if (salt.length !== 16 || expectedKey.length !== passwordKeyLength) {
      return { valid: false, needsRehash: false };
    }

    const actualKey = await deriveKey(password, salt);
    return {
      valid: timingSafeEqual(actualKey, expectedKey),
      needsRehash: false,
    };
  }

  const provided = Buffer.from(password, "utf8");
  const legacy = Buffer.from(storedPassword, "utf8");
  const valid =
    provided.length === legacy.length && timingSafeEqual(provided, legacy);

  return { valid, needsRehash: valid };
}

export function getPasswordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url");
}

function getSessionSecret(): Buffer {
  const secret = process.env.SESSION_SECRET;

  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes.");
  }

  return Buffer.from(secret, "utf8");
}

export function normalizeUserRole(value: unknown): UserRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const role = value.toLowerCase();
  if (role === "admin") return "Admin";
  if (role === "owner") return "Owner";
  if (role === "karyawan") return "Karyawan";
  if (role === "pelanggan") return "Pelanggan";
  return null;
}

export function dashboardPath(role: UserRole): string {
  switch (role) {
    case "Admin":
      return "/admin";
    case "Owner":
      return "/owner";
    case "Karyawan":
      return "/karyawan";
    case "Pelanggan":
      return "/";
  }
}

export function createSessionToken(
  userId: string,
  role: UserRole,
  passwordHash: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const session: Session = {
    userId,
    role,
    passwordFingerprint: getPasswordFingerprint(passwordHash),
    expiresAt: now + sessionLifetimeSeconds,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token || token.length > 2048) {
    return null;
  }

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest();
  const suppliedSignature = Buffer.from(signature, "base64url");

  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );

    if (
      typeof value !== "object" ||
      value === null ||
      !("userId" in value) ||
      !("role" in value) ||
      !("passwordFingerprint" in value) ||
      !("expiresAt" in value) ||
      typeof value.userId !== "string" ||
      typeof value.passwordFingerprint !== "string" ||
      typeof value.expiresAt !== "number"
    ) {
      return null;
    }

    const role = normalizeUserRole(value.role);
    if (!role || value.expiresAt <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      userId: value.userId,
      role,
      passwordFingerprint: value.passwordFingerprint,
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request): Session | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));

  return verifySessionToken(cookie?.slice(sessionCookieName.length + 1));
}
