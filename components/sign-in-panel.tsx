"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { EmailSignIn } from "@/components/email-sign-in";

type Tab = "google" | "email";

export function SignInPanel() {
  const [tab, setTab] = useState<Tab>("google");
  const [providerIds, setProviderIds] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, unknown>) => {
        setProviderIds(Object.keys(data ?? {}));
      })
      .catch(() => setProviderIds([]));
  }, []);

  const hasGoogle = providerIds?.includes("google") ?? false;

  useEffect(() => {
    if (providerIds && !hasGoogle) {
      setTab("email");
    }
  }, [providerIds, hasGoogle]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 rounded-2xl border border-slate-200 bg-white px-8 py-12 shadow-sm">
      <div className="text-center">
        <div className="flex justify-center">
          <BrandLogo size={72} priority className="drop-shadow-sm" />
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-emerald-600">
          Ave.ai
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          热门搜索（Trending）申请
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          {hasGoogle
            ? "请使用 Google 或邮箱验证码登录后再填写申请表。平台将按申请顺序及合约安全性审核。"
            : "请使用邮箱验证码登录后再填写申请表。平台将按申请顺序及合约安全性审核。"}
        </p>
      </div>

      {providerIds === null ? (
        <p className="text-sm text-slate-500">正在准备登录…</p>
      ) : hasGoogle ? (
        <div className="flex w-full max-w-xs rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab("google")}
            className={`flex-1 rounded-md py-2 transition ${
              tab === "google" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`flex-1 rounded-md py-2 transition ${
              tab === "email" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            邮箱验证码
          </button>
        </div>
      ) : null}

      {providerIds !== null && hasGoogle && tab === "google" ? (
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="flex w-full max-w-xs items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          使用 Google 登录
        </button>
      ) : providerIds !== null ? (
        <EmailSignIn />
      ) : null}

      <p className="text-center text-xs text-slate-500">
        登录即表示您同意仅将账号用于本申请流程的身份校验。
      </p>
    </div>
  );
}
