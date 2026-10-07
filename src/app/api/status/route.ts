import { connection } from "next/server";
import { loadCredentials, getPublisher, googleMessage } from "@/lib/google";
import { authEnabled } from "@/lib/auth";
import { route } from "@/lib/route";
import { listApps } from "@/lib/store";
import { humanizeError } from "@/lib/errors";

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
  } = {
    credentials: creds.ok
      ? { ok: true, source: creds.source, email: creds.key.client_email, projectId: creds.key.project_id }
      : { ok: false, source: creds.source, error: creds.error },
    passwordEnabled: authEnabled(),
    appsCount: (await listApps()).length,
  };
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
