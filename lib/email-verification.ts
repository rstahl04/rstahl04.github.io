import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

type VerificationRecord = {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
};

const DATA_DIR = path.join(process.cwd(), "data");
const CODES_FILE = path.join(DATA_DIR, "email-codes.json");
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export function createEmailVerification(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const code = String(randomInt(100000, 999999));
  const records = readRecords().filter((record) => record.email !== normalizedEmail);
  const record: VerificationRecord = {
    email: normalizedEmail,
    codeHash: hashCode(normalizedEmail, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    attempts: 0
  };

  writeRecords([...records, record]);
  return { code, expiresAt: record.expiresAt };
}

export function verifyEmailCode(email: string, code: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const records = readRecords();
  const record = records.find((candidate) => candidate.email === normalizedEmail);

  if (!record) return { ok: false, error: "Please request a new verification code." };

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    writeRecords(records.filter((candidate) => candidate.email !== normalizedEmail));
    return { ok: false, error: "That verification code expired. Please request a new code." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    writeRecords(records.filter((candidate) => candidate.email !== normalizedEmail));
    return { ok: false, error: "Too many attempts. Please request a new verification code." };
  }

  const isMatch = safeEqual(record.codeHash, hashCode(normalizedEmail, code.trim()));

  if (!isMatch) {
    writeRecords(
      records.map((candidate) =>
        candidate.email === normalizedEmail ? { ...candidate, attempts: candidate.attempts + 1 } : candidate
      )
    );
    return { ok: false, error: "That verification code is incorrect." };
  }

  writeRecords(records.filter((candidate) => candidate.email !== normalizedEmail));
  return { ok: true };
}

function readRecords() {
  try {
    if (!existsSync(CODES_FILE)) return [];
    return JSON.parse(readFileSync(CODES_FILE, "utf8")) as VerificationRecord[];
  } catch {
    return [];
  }
}

function writeRecords(records: VerificationRecord[]) {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  writeFileSync(CODES_FILE, JSON.stringify(records, null, 2));
}

function hashCode(email: string, code: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || "dev-only-change-this-secret")
    .update(`${email}:${code}`)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
