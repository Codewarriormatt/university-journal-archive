import { scryptSync, timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";

const BCRYPT_COST = 12;

export function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

export function verifyPassword(password, storedHash) {
  if (String(storedHash ?? "").startsWith("$2")) {
    return bcrypt.compareSync(password, storedHash);
  }

  const parts = String(storedHash ?? "").split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, N, r, p, saltValue, hashValue] = parts;
  const expected = Buffer.from(hashValue, "base64");
  const actual = scryptSync(password, Buffer.from(saltValue, "base64"), expected.length, {
    N: Number.parseInt(N, 10),
    r: Number.parseInt(r, 10),
    p: Number.parseInt(p, 10),
    maxmem: 64 * 1024 * 1024
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
