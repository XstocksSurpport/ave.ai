"use client";

import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

export function EmailSignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [devCodeDisplay, setDevCodeDisplay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const sendCode = useCallback(async () => {
    setError(null);
    setHint(null);
    setDevCodeDisplay(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("请输入邮箱");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json()) as {
        error?: string;
        ok?: boolean;
        devMode?: boolean;
        devCode?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "发送失败");
        if (res.status === 429) {
          const m = /请 (\d+) 秒/.exec(data.error ?? "");
          if (m) setCooldown(Number(m[1]));
        }
        return;
      }
      if (data.devMode && data.devCode) {
        setHint(
          `本地开发未配置邮件：验证码为下方数字（同一内容也会打印在运行 npm run dev 的终端）。`,
        );
        setDevCodeDisplay(data.devCode);
      } else {
        setDevCodeDisplay(null);
        setHint("验证码已发送至邮箱，请查收（含垃圾箱与推广邮件夹）。");
      }
      setCooldown(60);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSending(false);
    }
  }, [email]);

  const login = useCallback(async () => {
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!trimmedEmail || !/^\d{6}$/.test(trimmedCode)) {
      setError("请输入邮箱与 6 位数字验证码");
      return;
    }
    setLoggingIn(true);
    try {
      const result = await signIn("email-code", {
        email: trimmedEmail,
        code: trimmedCode,
        redirect: false,
        callbackUrl: "/",
      });
      if (result?.error) {
        setError("验证码错误或已过期，请重新获取");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoggingIn(false);
    }
  }, [email, code]);

  return (
    <div className="w-full max-w-xs space-y-4">
      <label className="block text-left">
        <span className="text-sm font-medium text-slate-700">邮箱</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="name@example.com"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={sending || cooldown > 0}
          onClick={sendCode}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {sending ? "发送中…" : cooldown > 0 ? `${cooldown}s 后可重发` : "发送验证码"}
        </button>
      </div>
      <label className="block text-left">
        <span className="text-sm font-medium text-slate-700">6 位验证码</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="000000"
        />
      </label>
      <button
        type="button"
        disabled={loggingIn}
        onClick={login}
        className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {loggingIn ? "登录中…" : "邮箱登录"}
      </button>
      {devCodeDisplay && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center"
          role="status"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-800">
            本地开发 · 验证码
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.25em] text-amber-950">
            {devCodeDisplay}
          </p>
        </div>
      )}
      {hint && <p className="text-xs text-emerald-800">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
