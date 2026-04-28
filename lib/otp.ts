import { randomInt, timingSafeEqual } from "node:crypto";

type Entry = { code: string; expiresAt: number; attempts: number };

const store = new Map<string, Entry>();
const lastSend = new Map<string, number>();

const SEND_COOLDOWN_MS = 60_000;
const OTP_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function canSendOtp(email: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const key = normalizeEmail(email);
  const last = lastSend.get(key) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < SEND_COOLDOWN_MS) {
    return { ok: false, retryAfterSec: Math.ceil((SEND_COOLDOWN_MS - elapsed) / 1000) };
  }
  return { ok: true };
}

export function recordOtpSent(email: string) {
  lastSend.set(normalizeEmail(email), Date.now());
}

/** 生成并保存 6 位数字验证码，返回明文（仅用于发信） */
export function createOtp(email: string): string {
  const key = normalizeEmail(email);
  const code = String(randomInt(100000, 999999));
  store.set(key, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
  return code;
}

export function clearOtp(email: string) {
  store.delete(normalizeEmail(email));
}

export function verifyOtp(email: string, input: string): boolean {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(key);
    return false;
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    return false;
  }
  const raw = input.trim();
  if (!/^\d{6}$/.test(raw)) {
    entry.attempts += 1;
    return false;
  }
  const a = Buffer.from(raw, "utf8");
  const b = Buffer.from(entry.code, "utf8");
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (ok) {
    store.delete(key);
    return true;
  }
  entry.attempts += 1;
  return false;
}
