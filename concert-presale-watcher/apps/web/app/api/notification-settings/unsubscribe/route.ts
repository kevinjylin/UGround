import { escapeHtml } from "../../../../lib/alertMessages";
import { logger } from "../../../../lib/logger";
import { verifyUnsubscribeToken } from "../../../../lib/notificationCrypto";
import { getBaseAppUrl } from "../../../../lib/notificationSettings";
import { disableEmailAlerts } from "../../../../lib/store/alertStore";

export const runtime = "nodejs";

/**
 * Public link from every alert email. It turns email alerts off (the address
 * stays saved, so they can be turned back on in Notifications). GET is the
 * link in the email; POST is RFC 8058 one-click unsubscribe from the mail
 * client, sent because of the List-Unsubscribe-Post header.
 */
const page = (status: number, heading: string, body: string): Response => {
  let dashboard: string | null = null;
  try {
    dashboard = `${getBaseAppUrl()}/dashboard`;
  } catch {
    dashboard = null;
  }
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(heading)} · UGround</title>
<style>
  body { margin: 0; background: #121211; color: #ededea; font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 440px; margin: 0 auto; padding: 72px 20px; }
  .mark { font-weight: 600; font-size: 14px; }
  .mark span { color: #f05a28; }
  h1 { font: 400 34px/1.15 Georgia, "Times New Roman", serif; margin: 28px 0 12px; }
  p { color: #a2a29c; margin: 0 0 16px; }
  a { color: #ededea; }
</style>
</head>
<body>
<main>
  <div class="mark"><span>&#9679;</span> UGround</div>
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(body)}</p>
  ${dashboard ? `<p><a href="${escapeHtml(dashboard)}">Open notification settings</a></p>` : ""}
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
};

const unsubscribe = async (token: string): Promise<"ok" | "invalid" | "error"> => {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return "invalid";
  try {
    await disableEmailAlerts(userId);
    return "ok";
  } catch (error) {
    logger.error("[unsubscribe] could not turn off email alerts", error);
    return "error";
  }
};

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await unsubscribe(token);
  if (result === "ok") {
    return page(
      200,
      "Email alerts are off",
      "You won't get alert emails from UGround. Your address is still saved, so you can turn them back on in Notifications.",
    );
  }
  if (result === "invalid") {
    return page(400, "This link didn't work", "The unsubscribe link is incomplete or was changed. Use the link from a recent alert email, or turn email alerts off in Notifications.");
  }
  return page(500, "Something went wrong", "Email alerts are still on. Try the link again in a minute, or turn them off in Notifications.");
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await unsubscribe(token);
  return new Response(null, { status: result === "ok" ? 200 : result === "invalid" ? 400 : 500 });
}
