import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { AppUser } from "./auth";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export function getStoredUsers(): AppUser[] {
  try {
    if (!existsSync(USERS_FILE)) return [];
    const raw = readFileSync(USERS_FILE, "utf8");
    return JSON.parse(raw) as AppUser[];
  } catch {
    return [];
  }
}

export function getStoredUser(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return getStoredUsers().find((user) => user.email === normalizedEmail);
}

export function upsertStoredUser(user: AppUser) {
  const normalizedUser = { ...user, email: user.email.trim().toLowerCase() };
  const users = getStoredUsers();
  const nextUsers = users.some((storedUser) => storedUser.email === normalizedUser.email)
    ? users.map((storedUser) => (storedUser.email === normalizedUser.email ? { ...storedUser, ...normalizedUser } : storedUser))
    : [...users, normalizedUser];

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  writeFileSync(USERS_FILE, JSON.stringify(nextUsers, null, 2));
  return normalizedUser;
}
