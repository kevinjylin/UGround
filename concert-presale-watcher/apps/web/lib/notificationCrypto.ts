import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
} from "node:crypto";
import { env } from "./env";

const algorithm = "aes-256-gcm";
const keyLength = 32;
const ivLength = 12;

const getEncryptionKey = (): Buffer => {
  if (!env.alertSettingsEncryptionKey) {
    throw new Error("Missing ALERT_SETTINGS_ENCRYPTION_KEY");
  }

  const trimmed = env.alertSettingsEncryptionKey.trim();
  const hexKey = /^[a-f0-9]{64}$/i.test(trimmed) ? Buffer.from(trimmed, "hex") : null;
  const base64Key = Buffer.from(trimmed, "base64");
  const key = hexKey?.length === keyLength ? hexKey : base64Key.length === keyLength ? base64Key : null;

  if (!key) {
    throw new Error("ALERT_SETTINGS_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value");
  }

  return key;
};

export const encryptSecret = (value: string): string => {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
};

export const decryptSecret = (encrypted: string | null): string | null => {
  if (!encrypted) {
    return null;
  }

  const [version, iv, tag, ciphertext] = encrypted.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted notification setting format");
  }

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

export const hashConfirmationValue = (value: string): string => {
  return createHash("sha256").update(value).digest("hex");
};

export const createEmailConfirmationToken = (): string => {
  return randomBytes(32).toString("hex");
};

export const createSmsConfirmationCode = (): string => {
  return String(randomInt(100000, 1000000));
};

export const createExpiry = (minutes: number): string => {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
};
