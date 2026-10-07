import { connection } from "next/server";
import { loadCredentials, getPublisher, googleMessage } from "@/lib/google";
import { authEnabled } from "@/lib/auth";
import { route } from "@/lib/route";
import { listApps } from "@/lib/store";
import { ApiError, humanizeError } from "@/lib/errors";
import { checkOpenAI, openaiConfig } from "@/lib/openai";

/** Перевірка підключення: ключ, токен Google, доступ до доданих застосунків. */
export const GET = route(async (req) => {
  await connection();
  const deep = new URL(req.url).searchParams.get("check") === "1";
  const creds = loadCredentials();
  const result: {
    credentials: { ok: boolean; source: string; error?: string; email?: string; projectId?: string };
    token?: { ok: boolean; error?: string; hint?: string };
    passwordEnabled: boolean;
    appsCount: number;
    openai: { configured: boolean; model: string; customModel: boolean; ok?: boolean; error?: string; hint?: string };
  } = {
    credentials: creds.ok
      ? { ok: true, source: creds.source, email: creds.key.client_email, projectId: creds.key.project_id }
      : { ok: false, source: creds.source, error: creds.error },
    passwordEnabled: authEnabled(),
    appsCount: (await listApps()).length,
    openai: { configured: openaiConfig().configured, model: openaiConfig().model, customModel: Boolean(process.env.OPENAI_MODEL?.trim()) },
  };
  if (deep && result.openai.configured) {
    try {
      await checkOpenAI();
      result.openai.ok = true;
    } catch (e) {
      result.openai.ok = false;
      result.openai.error = e instanceof Error ? e.message : String(e);
      result.openai.hint = e instanceof ApiError ? e.hint : undefined;
    }
  }
  if (deep && creds.ok) {
    try {
      const api = getPublisher();
      const auth = api.context._options.auth as { getAccessToken: () => Promise<unknown> };
      await auth.getAccessToken();
      result.token = { ok: true };
    } catch (e) {
      const h = humanizeError(500, googleMessage(e));
      result.token = { ok: false, error: h.message, hint: h.hint };
    }
  }
  return result;
});
