import { auth } from "@/auth";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "请先使用 Google 登录。" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "无效的表单数据。" }, { status: 400 });
  }

  const tokenSymbol = String(form.get("tokenSymbol") ?? "").trim();
  const contractAddress = String(form.get("contractAddress") ?? "").trim();
  const chain = String(form.get("chain") ?? "").trim();
  const chainOther = String(form.get("chainOther") ?? "").trim();
  const telegram = String(form.get("telegram") ?? "").trim();
  const twitter = String(form.get("twitter") ?? "").trim();
  const plan = String(form.get("plan") ?? "").trim();
  const txHash = String(form.get("txHash") ?? "").trim();
  const contactTelegram = String(form.get("contactTelegram") ?? "").trim();

  if (!tokenSymbol || !contractAddress) {
    return NextResponse.json({ error: "请填写代币名称与合约地址。" }, { status: 400 });
  }
  if (!chain) {
    return NextResponse.json({ error: "请选择所属公链。" }, { status: 400 });
  }
  if (chain === "OTHER" && !chainOther) {
    return NextResponse.json({ error: "请填写「其他」公链名称。" }, { status: 400 });
  }
  if (plan !== "A" && plan !== "B" && plan !== "C") {
    return NextResponse.json({ error: "请选择方案 A、B 或 C。" }, { status: 400 });
  }

  const normalized = txHash.replace(/^0x/i, "");
  if (normalized && !/^[a-fA-F0-9]{64}$/.test(normalized)) {
    return NextResponse.json({ error: "交易哈希格式不正确。" }, { status: 400 });
  }

  const id = randomUUID();
  const dir = join(process.cwd(), "submissions", id);
  await mkdir(dir, { recursive: true });

  const file = form.get("screenshot");
  let screenshotName: string | null = null;
  if (file instanceof Blob && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "截图文件过大（最大 8MB）。" }, { status: 400 });
    }
    const mime = file.type || "image/png";
    const ext =
      mime.includes("jpeg") || mime.includes("jpg")
        ? "jpg"
        : mime.includes("webp")
          ? "webp"
          : mime.includes("gif")
            ? "gif"
            : "png";
    screenshotName = `payment-proof.${ext}`;
    await writeFile(join(dir, screenshotName), buf);
  }

  const payload = {
    id,
    submittedAt: new Date().toISOString(),
    applicant: {
      email: session.user.email,
      name: session.user.name,
    },
    project: {
      tokenSymbol,
      contractAddress,
      chain,
      chainOther: chain === "OTHER" ? chainOther : undefined,
      telegram: telegram || undefined,
      twitter: twitter || undefined,
    },
    plan,
    payment: {
      txHash: txHash || undefined,
      screenshotFile: screenshotName,
    },
    contactTelegram: contactTelegram || undefined,
  };

  await writeFile(join(dir, "application.json"), JSON.stringify(payload, null, 2), "utf-8");

  return NextResponse.json({ id });
}
