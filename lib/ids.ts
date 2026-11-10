import { randomBytes } from "node:crypto";

export function createDatabaseId(prefix: string, length: number): string {
  const suffixLength = length - prefix.length;
  if (suffixLength < 1) {
    throw new Error("Database ID length must leave room for a random suffix.");
  }

  const randomLength = Math.ceil((suffixLength * 3) / 4);
  return `${prefix}${randomBytes(randomLength)
    .toString("base64url")
    .slice(0, suffixLength)}`;
}
