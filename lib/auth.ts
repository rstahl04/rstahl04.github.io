import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { getStoredUsers } from "./user-store";

export type UserRole = "owner" | "admin" | "employee" | "subscriber";
export type AccessStatus = "free" | "active" | "inactive";

export type AppUser = {
  email: string;
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  role: UserRole;
  access: AccessStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: string;
};

export type SessionUser = Omit<AppUser, "password" | "passwordHash" | "passwordSalt">;

const SESSION_COOKIE = "prompter_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function getConfiguredUsers(): AppUser[] {
  const rawUsers = process.env.PROMPTER_USERS_JSON;

  if (rawUsers) {
    try {
      const users = JSON.parse(rawUsers) as AppUser[];
      return users
        .map((user) => ({
          email: String(user.email ?? "").trim().toLowerCase(),
          password: String(user.password ?? ""),
          role: normalizeRole(user.role),
          access: normalizeAccess(user.access)
        }))
        .filter((user) => user.email && user.password);
    } catch {
      return [];
    }
  }

  const adminEmail = process.env.PROMPTER_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.PROMPTER_ADMIN_PASSWORD ?? "";

  if (!adminEmail || !adminPassword) return [];

  return [{ email: adminEmail, password: adminPassword, role: "owner", access: "free" }];
}

export function findUser(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return [...getConfiguredUsers(), ...getStoredUsers()].find((user) => user.email === normalizedEmail);
}

export function verifyPassword(user: AppUser, password: string) {
  if (user.passwordHash && user.passwordSalt) {
    return safeEqual(user.passwordHash, hashPassword(password, user.passwordSalt));
  }

  return safeEqual(user.password ?? "", password);
}

export function hasAppAccess(user: SessionUser) {
  return user.access === "free" || user.access === "active";
}

export function createSessionCookie(user: SessionUser) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = toBase64Url(JSON.stringify({ ...user, exp: expiresAt }));
  const signature = sign(payload);

  return `${SESSION_COOKIE}=${payload}.${signature}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_SECONDS}; SameSite=Lax`;
}

export function createPasswordRecord(password: string) {
  const salt = randomBytes(16).toString("hex");
  return {
    passwordHash: hashPassword(password, salt),
    passwordSalt: salt
  };
}

export function createLogoutCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getSessionFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  if (!cookie) return null;

  const value = cookie.slice(SESSION_COOKIE.length + 1);
  return parseSessionCookie(value);
}

export function parseSessionCookie(value: string | undefined) {
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as SessionUser & { exp: number };
    if (!parsed.email || !parsed.role || !parsed.access || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      email: parsed.email,
      role: normalizeRole(parsed.role),
      access: normalizeAccess(parsed.access)
    };
  } catch {
    return null;
  }
}

function sign(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function getAuthSecret() {
  return process.env.AUTH_SECRET || "dev-only-change-this-secret";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function hashPassword(password: string, salt: string) {
  return pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
}

function normalizeRole(role: unknown): UserRole {
  if (role === "admin" || role === "employee" || role === "subscriber") return role;
  return "owner";
}

function normalizeAccess(access: unknown): AccessStatus {
  if (access === "active" || access === "inactive") return access;
  return "free";
}
