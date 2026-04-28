"use client";

import { BrandLogo } from "@/components/brand-logo";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { useCallback, useEffect, useState } from "react";

const CHAINS = [
  { id: "ETH", label: "ETH" },
  { id: "BSC", label: "BSC (BNB Chain)" },
  { id: "Solana", label: "Solana" },
  { id: "Base", label: "Base" },
  { id: "OTHER", label: "其他" },
] as const;

type ChainId = (typeof CHAINS)[number]["id"];
type Plan = "A" | "B" | "C";
type PaymentPhase = "link" | "address" | "done";

const PAYMENT_LINK_MS = 2000;
const PAYMENT_ADDRESS_GEN_MS = 1500;

const PAYMENT_ADDRESS = "0x28ADddf28006F26B500F916Cb3652aFeB98DD34B";

/** 与第二部分方案表一致 */
const PLAN_TRANSFER_AMOUNT: Record<Plan, string> = {
  A: "500 USDT",
  B: "1,500 USDT",
  C: "3,000 USDT",
};

export function ApplicationForm({ session }: { session: Session }) {
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [chain, setChain] = useState<ChainId | "">("");
  const [chainOther, setChainOther] = useState("");
  const [telegram, setTelegram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [plan, setPlan] = useState<Plan | "">("");
  const [txHash, setTxHash] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [contactTg, setContactTg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [riskHelpOpen, setRiskHelpOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>("link");
  const [addressRevealed, setAddressRevealed] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  const user = session.user;

  useEffect(() => {
    if (!paymentModalOpen) return;
    if (addressRevealed) {
      setPaymentPhase("done");
      return;
    }
    setPaymentPhase("link");
    const t1 = setTimeout(() => setPaymentPhase("address"), PAYMENT_LINK_MS);
    const t2 = setTimeout(() => {
      setPaymentPhase("done");
      setAddressRevealed(true);
    }, PAYMENT_LINK_MS + PAYMENT_ADDRESS_GEN_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [paymentModalOpen, addressRevealed]);

  useEffect(() => {
    if (!paymentNotice) return;
    const timer = setTimeout(() => setPaymentNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [paymentNotice]);

  const copyPaymentAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PAYMENT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage({ type: "err", text: "复制失败，请手动复制收款地址。" });
    }
  }, []);

  /** 关闭弹窗后回到「获取收款地址」按钮，不在表单内常驻展示收款信息 */
  const closePaymentModal = useCallback(() => {
    setPaymentModalOpen(false);
    setAddressRevealed(false);
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage(null);

      if (!tokenSymbol.trim() || !contractAddress.trim()) {
        setMessage({ type: "err", text: "请填写代币名称与合约地址。" });
        return;
      }
      if (!chain) {
        setMessage({ type: "err", text: "请选择所属公链。" });
        return;
      }
      if (chain === "OTHER" && !chainOther.trim()) {
        setMessage({ type: "err", text: "请填写「其他」公链名称。" });
        return;
      }
      if (!plan) {
        setMessage({ type: "err", text: "请选择热搜服务方案（A、B 或 C）。" });
        return;
      }
      const normalizedTx = txHash.trim().replace(/^0x/i, "");
      if (normalizedTx && !/^[a-fA-F0-9]{64}$/.test(normalizedTx)) {
        setMessage({
          type: "err",
          text: "交易哈希应为 64 位十六进制字符（可含或不含 0x 前缀）。",
        });
        return;
      }

      const fd = new FormData();
      fd.append("tokenSymbol", tokenSymbol.trim());
      fd.append("contractAddress", contractAddress.trim());
      fd.append("chain", chain);
      if (chain === "OTHER") fd.append("chainOther", chainOther.trim());
      fd.append("telegram", telegram.trim());
      fd.append("twitter", twitter.trim());
      fd.append("plan", plan);
      fd.append("txHash", txHash.trim());
      fd.append("contactTelegram", contactTg.trim());
      if (screenshot) fd.append("screenshot", screenshot);

      setSubmitting(true);
      try {
        const res = await fetch("/api/submit", { method: "POST", body: fd });
        const data = (await res.json()) as { error?: string; id?: string };
        if (!res.ok) {
          setMessage({ type: "err", text: data.error ?? "提交失败，请稍后重试。" });
          return;
        }
        setMessage({
          type: "ok",
          text: `申请已提交（编号 ${data.id?.slice(0, 8) ?? "—"}）。系统将在 30–60 分钟内完成链上确认并安排排期。`,
        });
      } catch {
        setMessage({ type: "err", text: "网络错误，请检查连接后重试。" });
      } finally {
        setSubmitting(false);
      }
    },
    [
      tokenSymbol,
      contractAddress,
      chain,
      chainOther,
      telegram,
      twitter,
      plan,
      txHash,
      screenshot,
      contactTg,
    ],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-10 flex flex-col gap-4 border-b border-slate-200 pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4 sm:items-start">
          <BrandLogo size={52} className="hidden sm:block" />
          <div>
            <div className="flex items-center gap-3 sm:hidden">
              <BrandLogo size={44} />
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-600">
                Ave.ai · Trending
              </p>
            </div>
            <p className="hidden text-xs font-medium uppercase tracking-[0.2em] text-emerald-600 sm:block">
              Ave.ai · Trending
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
              热门搜索位申请表
            </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            本表单用于申请「热门搜索」榜单推荐位。审核通过后将在指定时间内上线；如因合约安全问题未通过，款项将按原路退回。
          </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {user?.image && (
            <img
              src={user.image}
              alt={user?.name ? `${user.name} 的头像` : "用户头像"}
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover"
            />
          )}
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium text-slate-900">{user?.name ?? "用户"}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/", redirect: true })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
          >
            退出
          </button>
        </div>
      </header>

      <form onSubmit={onSubmit} className="space-y-10">
        {/* Part 1 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="border-b border-slate-200 pb-3 text-lg font-semibold text-slate-900">
            第一部分：项目基础信息
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-1">
              <span className="text-sm font-medium text-slate-700">代币名称 (Token Symbol)</span>
              <input
                required
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="例如 TOKEN"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                合约地址 (CA)
              </span>
              <span className="ml-2 text-xs text-slate-500">
                （请确保合约无高危代码或权限）
              </span>
              <button
                type="button"
                onClick={() => setRiskHelpOpen(true)}
                className="ml-2 text-xs text-emerald-700 underline decoration-dotted underline-offset-2 hover:text-emerald-600"
              >
                何为高危代码？
              </button>
              <input
                required
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="0x…"
              />
            </label>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-slate-700">所属公链</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {CHAINS.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    chain === c.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : "border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="chain"
                    value={c.id}
                    checked={chain === c.id}
                    onChange={() => setChain(c.id)}
                    className="accent-emerald-600"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            {chain === "OTHER" && (
              <input
                value={chainOther}
                onChange={(e) => setChainOther(e.target.value)}
                className="mt-3 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="请填写公链名称"
              />
            )}
          </fieldset>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Telegram 链接</span>
              <input
                type="url"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="https://t.me/…"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Twitter (X) 链接</span>
              <input
                type="url"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                placeholder="https://x.com/…"
              />
            </label>
          </div>
        </section>

        {/* Part 2 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="border-b border-slate-200 pb-3 text-lg font-semibold text-slate-900">
            第二部分：热搜服务方案选择
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            请选择拟申请的广告方案（展示有效期与费用见下表）。
          </p>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">选项</th>
                  <th className="px-4 py-3 font-medium">位置</th>
                  <th className="px-4 py-3 font-medium">费用</th>
                  <th className="px-4 py-3 font-medium">有效期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr className={plan === "A" ? "bg-emerald-50/80" : ""}>
                  <td className="px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-2 text-slate-900">
                      <input
                        type="radio"
                        name="plan"
                        checked={plan === "A"}
                        onChange={() => setPlan("A")}
                        className="accent-emerald-600"
                      />
                      方案 A
                    </label>
                  </td>
                  <td className="px-4 py-3 text-slate-700">热搜榜单前 10 位</td>
                  <td className="px-4 py-3 font-medium text-amber-700">500 USDT</td>
                  <td className="px-4 py-3 text-slate-600">24 小时</td>
                </tr>
                <tr className={plan === "B" ? "bg-emerald-50/80" : ""}>
                  <td className="px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-2 text-slate-900">
                      <input
                        type="radio"
                        name="plan"
                        checked={plan === "B"}
                        onChange={() => setPlan("B")}
                        className="accent-emerald-600"
                      />
                      方案 B
                    </label>
                  </td>
                  <td className="px-4 py-3 text-slate-700">热搜榜单前 3 位</td>
                  <td className="px-4 py-3 font-medium text-amber-700">1,500 USDT</td>
                  <td className="px-4 py-3 text-slate-600">24 小时</td>
                </tr>
                <tr className={plan === "C" ? "bg-emerald-50/80" : ""}>
                  <td className="px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-2 text-slate-900">
                      <input
                        type="radio"
                        name="plan"
                        checked={plan === "C"}
                        onChange={() => setPlan("C")}
                        className="accent-emerald-600"
                      />
                      方案 C
                    </label>
                  </td>
                  <td className="px-4 py-3 text-slate-700">热搜榜单前 3 位</td>
                  <td className="px-4 py-3 font-medium text-amber-700">3,000 USDT</td>
                  <td className="px-4 py-3 text-slate-600">72 小时</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Part 3 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="border-b border-slate-200 pb-3 text-lg font-semibold text-slate-900">
            第三部分：支付信息（自助结算）
          </h2>
          <p className="mt-4 text-sm text-slate-600">
            请将对应费用转入官方生成的收款地址。
            <span className="font-semibold text-red-600">
              为防止剪贴板病毒，确认交易前请务必核对收款地址首尾数字
            </span>
            ，确认地址准确，转账金额需与所选方案一致。
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
            <p className="text-sm text-slate-600">
              点击下方按钮生成付款信息，系统将为您准备收款地址。
            </p>
            <button
              type="button"
              onClick={() => {
                if (!plan) {
                  setPaymentNotice("请先在第二部分中选择热搜服务方案（A、B 或 C），再获取收款地址。");
                  return;
                }
                setPaymentNotice(null);
                setPaymentModalOpen(true);
              }}
              className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              获取收款地址
            </button>
            {paymentNotice && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-800 shadow-sm ring-1 ring-red-200"
              >
                {paymentNotice}
              </p>
            )}
          </div>
        </section>

        {/* Part 4 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="border-b border-slate-200 pb-3 text-lg font-semibold text-slate-900">
            第四部分：付款凭证提交
          </h2>
          <label className="mt-6 block">
            <span className="text-sm font-medium text-slate-700">
              支付交易哈希 (Transaction Hash / TXID)
            </span>
            <span className="ml-2 text-xs text-slate-500">
              （请粘贴完整 64 位哈希以便后台自动对账）
            </span>
            <input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              placeholder="0x 开头的 66 字符或 64 位 hex"
            />
          </label>
          <label className="mt-6 block">
            <span className="text-sm font-medium text-slate-700">支付凭证截图上传</span>
            <span className="mt-1 block text-xs text-slate-500">
              图片需清晰包含：收款地址、转账金额、交易状态及时间。
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-500"
            />
            {screenshot && (
              <p className="mt-2 text-xs text-slate-500">已选择：{screenshot.name}</p>
            )}
          </label>
        </section>

        {/* Part 5 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="border-b border-slate-200 pb-3 text-lg font-semibold text-slate-900">
            第五部分：联系方式（选填）
          </h2>
          <label className="mt-6 block max-w-md">
            <span className="text-sm font-medium text-slate-700">负责人 Telegram ID</span>
            <span className="mt-1 block text-xs text-slate-500">
              用于审核未通过或需调整上线时间时紧急联系。
            </span>
            <input
              value={contactTg}
              onChange={(e) => setContactTg(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              placeholder="@username"
            />
          </label>
        </section>

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-base font-semibold text-white shadow-md transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
        >
          {submitting ? "提交中…" : "提交申请"}
        </button>

        <p className="text-center text-xs text-slate-500">
          温馨提示：提交后系统将在 30–60 分钟内完成链上确认并安排排期。如因合约安全问题（如蜜罐等）未通过审核，款项将按原路退回。
        </p>
      </form>

      {paymentModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            {paymentPhase !== "done" ? (
              <div className="flex flex-col items-center text-center">
                {/* 两阶段进度：进入第 2 步时连线与配色一起变，过渡更明显 */}
                <div className="mb-6 w-full max-w-xs">
                  <div className="flex items-start justify-between gap-1">
                    <div
                      className={`flex flex-1 flex-col items-center transition-all duration-300 ${
                        paymentPhase === "link"
                          ? "scale-105"
                          : "scale-100 opacity-90"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                          paymentPhase === "link"
                            ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm ring-2 ring-emerald-200"
                            : "border-2 border-emerald-600 bg-emerald-600 text-white"
                        }`}
                      >
                        {paymentPhase === "address" ? "✓" : "1"}
                      </span>
                      <span className="mt-1.5 max-w-[4.5rem] text-center text-[11px] font-medium leading-tight text-slate-600">
                        付款链接
                      </span>
                    </div>

                    <div className="relative mx-1 mt-[17px] h-1 min-w-0 flex-[1.2] rounded-full bg-slate-200">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 ease-out ${
                          paymentPhase === "address" ? "w-full" : "w-0"
                        }`}
                      />
                    </div>

                    <div
                      className={`flex flex-1 flex-col items-center transition-all duration-300 ${
                        paymentPhase === "address"
                          ? "scale-105"
                          : "scale-100 opacity-55"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                          paymentPhase === "address"
                            ? "border-2 border-amber-600 bg-amber-50 text-amber-900 shadow-sm ring-2 ring-amber-200"
                            : "border-2 border-slate-300 bg-white text-slate-400"
                        }`}
                      >
                        2
                      </span>
                      <span className="mt-1.5 max-w-[4.5rem] text-center text-[11px] font-medium leading-tight text-slate-600">
                        付款地址
                      </span>
                    </div>
                  </div>
                </div>

                <div key={paymentPhase} className="payment-phase-swap flex flex-col items-center">
                  <span
                    className={`inline-block h-10 w-10 animate-spin rounded-full border-2 border-t-transparent transition-colors duration-300 ${
                      paymentPhase === "link"
                        ? "border-emerald-600"
                        : "border-amber-600"
                    }`}
                    aria-hidden
                  />
                  <p id="payment-modal-title" className="mt-5 text-base font-semibold text-slate-900">
                    {paymentPhase === "link"
                      ? "正在生成付款链接"
                      : "正在生成付款地址"}
                  </p>
                  <p
                    className={`mt-1 text-sm transition-colors duration-300 ${
                      paymentPhase === "link" ? "text-emerald-700" : "text-amber-800"
                    }`}
                  >
                    {paymentPhase === "link"
                      ? "第 1 步：建立安全付款通道…"
                      : "第 2 步：为您分配链上收款地址…"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">请稍候…</p>
                </div>
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="mt-6 text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h2 id="payment-modal-title" className="sr-only">
                  收款地址已生成
                </h2>
                <p className="break-all rounded-lg border border-slate-100 bg-slate-50 px-3 py-4 font-mono text-sm leading-relaxed text-slate-900">
                  {PAYMENT_ADDRESS}
                </p>
                <p className="mt-3 text-center text-xs text-emerald-800">
                  收款网络：BEP20 (BSC) 或 ERC20
                </p>
                {plan ? (
                  <p className="mt-3 text-center text-sm text-slate-800">
                    转账金额（请按所选方案足额转入）：
                    <span className="ml-1 font-semibold tabular-nums text-amber-700">
                      {PLAN_TRANSFER_AMOUNT[plan]}
                    </span>
                  </p>
                ) : null}
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={copyPaymentAddress}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    {copied ? "已复制" : "复制地址"}
                  </button>
                  <button
                    type="button"
                    onClick={closePaymentModal}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    关闭
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {riskHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">高危代码/权限说明</h3>
              <button
                type="button"
                onClick={() => setRiskHelpOpen(false)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              高危代码通常指：项目方可单方面冻结、限制、增发、修改税率或转移用户资产的逻辑，可能导致用户无法卖出或资产价值被稀释。
            </p>
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-800">常见风险函数/权限点（示例）</p>
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-slate-600">
                <li>
                  <span className="font-mono text-slate-800">blacklist(address,bool)</span>、
                  <span className="font-mono text-slate-800"> setBlacklist</span>：可拉黑地址，导致无法转账/卖出
                </li>
                <li>
                  <span className="font-mono text-slate-800">pause()</span>、
                  <span className="font-mono text-slate-800"> setTradingEnabled(bool)</span>：可随时暂停交易
                </li>
                <li>
                  <span className="font-mono text-slate-800">mint(address,uint256)</span>：可增发代币，造成稀释风险
                </li>
                <li>
                  <span className="font-mono text-slate-800">setTaxFee(uint256)</span>、
                  <span className="font-mono text-slate-800"> setSellFee</span>：可随意上调买卖税
                </li>
                <li>
                  <span className="font-mono text-slate-800">setRouter</span>、
                  <span className="font-mono text-slate-800"> setPair</span>：可修改交易路由/交易对
                </li>
                <li>
                  <span className="font-mono text-slate-800">withdrawToken</span>、
                  <span className="font-mono text-slate-800"> rescueToken</span>、
                  <span className="font-mono text-slate-800"> transferOwnership</span>：
                  高权限可提走资金或转移控制权
                </li>
              </ul>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              注：以上为常见模式，不同项目命名不同，建议结合审计报告和源码逐项验证。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
