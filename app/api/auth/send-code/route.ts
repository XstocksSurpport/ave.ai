import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import {
  OTP_COOKIE_NAME,
  sealOtpPayload,
} from "@/lib/otp-cookie";
import { canSendOtp, normalizeEmail, recordOtpSent } from "@/lib/otp";
import { sendVerificationEmail } from "@/lib/send-verification-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authSecret() {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
}

export async function POST(req: Request) {
  const secret = authSecret();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "服务器未配置 AUTH_SECRET，无法使用邮箱验证码。请在部署平台（如 Vercel）环境变量中设置 AUTH_SECRET，可本地执行 npx auth secret 生成。",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof (body as { email: unknown }).email === "string"
      ? (body as { email: string }).email.trim()
      : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  const gate = canSendOtp(normalized);
  if (!gate.ok) {
    return NextResponse.json(
      { error: `发送过于频繁，请 ${gate.retryAfterSec} 秒后再试` },
      { status: 429 },
    );
  }

  const code = String(randomInt(100000, 999999));
  try {
    await sendVerificationEmail(normalized, code);
  } catch (e) {
    const message = e instanceof Error ? e.message : "邮件发送失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  recordOtpSent(normalized);

  const sealed = sealOtpPayload(
    { e: normalized, c: code, x: Date.now() + 10 * 60 * 1000 },
    secret,
  );

  const devMode =
    process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY;

  const res = NextResponse.json({
    ok: true as const,
    ...(devMode
      ? {
          devMode: true as const,
          devCode: code,
        }
      : {}),
  });

  res.cookies.set(OTP_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return res;
}
