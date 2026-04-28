/** 发送频率限制（内存，多实例下为尽力而为；主要仍依赖前端 60s 与邮件服务商限制） */

const lastSend = new Map<string, number>();

const SEND_COOLDOWN_MS = 60_000;

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
