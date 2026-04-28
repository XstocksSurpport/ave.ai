import { createHmac, timingSafeEqual } from "node:crypto";

/** 与登录同域的 HttpOnly Cookie，用于在 Serverless 多实例间传递一次性验证码 */
export const OTP_COOKIE_NAME = "ave_auth_otp";

export type OtpSealPayload = {
  e: string;
  c: string;
  x: number;
};

export function sealOtpPayload(payload: OtpSealPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function unsealOtpPayload(token: string, secret: string): OtpSealPayload | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    if (typeof o.e !== "string" || typeof o.c !== "string" || typeof o.x !== "number") return null;
    return { e: o.e, c: o.c, x: o.x };
  } catch {
    return null;
  }
}

export function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const s = part.trim();
    const eq = s.indexOf("=");
    if (eq === -1) continue;
    const k = s.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(s.slice(eq + 1));
  }
  return null;
}
