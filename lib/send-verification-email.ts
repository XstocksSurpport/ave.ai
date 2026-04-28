/**
 * 发送登录验证码邮件。
 * 生产环境需配置 RESEND_API_KEY（及可选 AUTH_EMAIL_FROM）。
 * 开发环境未配置密钥时仅打印到服务端控制台。
 */
export async function sendVerificationEmail(to: string, code: string) {
  const subject = "Ave.ai 热门搜索申请 — 登录验证码";
  const html = `
    <p>您好，</p>
    <p>您的登录验证码为：<strong style="font-size:20px;letter-spacing:0.1em">${code}</strong></p>
    <p>验证码 <strong>10 分钟</strong> 内有效，请勿向他人泄露。</p>
    <p>如非本人操作，请忽略本邮件。</p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.AUTH_EMAIL_FROM?.trim() || "Ave <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[email-otp] 未配置 RESEND_API_KEY，验证码（仅开发） ${to} → ${code}`);
      return;
    }
    throw new Error("未配置邮件服务：请在环境变量中设置 RESEND_API_KEY");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let apiMessage = text;
    try {
      const j = JSON.parse(text) as { message?: string; name?: string };
      if (typeof j.message === "string") apiMessage = j.message;
    } catch {
      /* 非 JSON */
    }

    if (
      res.status === 403 &&
      (/testing emails|own email address|validation_error/i.test(apiMessage) ||
        /只能.*测试|測試郵件/i.test(apiMessage))
    ) {
      throw new Error(
        "Resend 测试限制：使用默认发件人 onboarding@resend.dev 时，收件人只能是您在 Resend 注册账号时所用的邮箱。若要给任意邮箱发验证码，请在 Resend 控制台「Domains」添加并验证您自己的域名，然后将环境变量 AUTH_EMAIL_FROM 设为该域名下的地址（例如 Ave <noreply@你的域名.com>）。",
      );
    }

    throw new Error(
      `邮件发送失败（${res.status}）：${apiMessage.length > 280 ? `${apiMessage.slice(0, 280)}…` : apiMessage}`,
    );
  }
}
