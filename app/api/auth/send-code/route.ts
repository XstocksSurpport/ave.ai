import { NextResponse } from "next/server";
import {
  canSendOtp,
  clearOtp,
  createOtp,
  normalizeEmail,
  recordOtpSent,
} from "@/lib/otp";
import { sendVerificationEmail } from "@/lib/send-verification-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
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

  const code = createOtp(normalized);
  try {
    await sendVerificationEmail(normalized, code);
  } catch (e) {
    clearOtp(normalized);
    const message = e instanceof Error ? e.message : "邮件发送失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  recordOtpSent(normalized);

  const devMode =
    process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY;

  return NextResponse.json({
    ok: true as const,
    ...(devMode
      ? {
          devMode: true as const,
          /** 仅本地开发、且未配置 RESEND 时返回，便于调试（生产构建不会返回） */
          devCode: code,
        }
      : {}),
  });
}
