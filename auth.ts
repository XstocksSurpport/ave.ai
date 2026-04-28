import { timingSafeEqual } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import {
  OTP_COOKIE_NAME,
  readCookieValue,
  unsealOtpPayload,
} from "@/lib/otp-cookie";
import { normalizeEmail } from "@/lib/otp";

function authSecret() {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
}

const googleId = process.env.AUTH_GOOGLE_ID?.trim();
const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim();

const providers = [
  ...(googleId && googleSecret
    ? [
        Google({
          clientId: googleId,
          clientSecret: googleSecret,
        }),
      ]
    : []),
  Credentials({
    id: "email-code",
    name: "邮箱验证码",
    credentials: {
      email: { label: "邮箱", type: "email" },
      code: { label: "验证码", type: "text" },
    },
    async authorize(credentials, request) {
      const email = credentials?.email;
      const code = credentials?.code;
      if (typeof email !== "string" || typeof code !== "string") return null;

      const normalized = normalizeEmail(email);
      const raw = code.trim();
      if (!/^\d{6}$/.test(raw)) return null;

      const secret = authSecret();
      if (!secret) return null;

      const cookieHeader = request.headers.get("cookie") ?? "";
      const token = readCookieValue(cookieHeader, OTP_COOKIE_NAME);
      if (!token) return null;

      const payload = unsealOtpPayload(token, secret);
      if (!payload || payload.e !== normalized) return null;
      if (Date.now() > payload.x) return null;

      const a = Buffer.from(raw, "utf8");
      const b = Buffer.from(payload.c, "utf8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

      return {
        id: normalized,
        email: normalized,
        name: normalized.split("@")[0] || "用户",
      };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret(),
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.name === "string") session.user.name = token.name;
      }
      return session;
    },
  },
});
