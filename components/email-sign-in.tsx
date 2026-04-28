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
      <details className="text-left text-xs text-slate-500">
        <summary className="cursor-pointer text-slate-600 hover:text-slate-800">
          收不到验证码？常见原因
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1.5 border-t border-slate-100 pt-2">
          <li>
            <strong>线上部署</strong>：必须在平台（如 Vercel）环境变量中配置{" "}
            <code className="rounded bg-slate-100 px-1">AUTH_SECRET</code> 与{" "}
            <code className="rounded bg-slate-100 px-1">AUTH_URL</code>（你的站点完整 https
            地址），否则会出现登录/session 500、退出无效等问题。可用 <code className="rounded bg-slate-100 px-1">npx auth secret</code>{" "}
            生成密钥。
          </li>
          <li>
            <strong>本地开发</strong>：若未在 <code className="rounded bg-slate-100 px-1">.env.local</code>{" "}
            配置 <code className="rounded bg-slate-100 px-1">RESEND_API_KEY</code>
            ，不会发真实邮件；验证码会显示在页面上方（仅开发环境）。
          </li>
          <li>
            <strong>已配置 Resend</strong>：使用默认发件人{" "}
            <code className="rounded bg-slate-100 px-1">onboarding@resend.dev</code> 时，收件邮箱必须与
            Resend 账号注册邮箱一致；要给任意邮箱发信，需在 Resend 验证自有域名并设置{" "}
            <code className="rounded bg-slate-100 px-1">AUTH_EMAIL_FROM</code>。
          </li>
          <li>检查垃圾箱、推广邮件；企业邮箱可能拦截外部发件，需联系管理员放行。</li>
        </ul>
      </details>
    </div>
  );
}
