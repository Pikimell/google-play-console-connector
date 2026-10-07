import "server-only";
import { ApiError, humanizeError } from "./errors";
import { googleMessage } from "./google";
import { isValidSession, readCookie, SESSION_COOKIE } from "./auth";

type Ctx<P> = { params: Promise<P> };

/**
 * Обгортка для API-маршрутів: перевірка пароля, JSON-відповідь, людські помилки.
 * (Авторизація тут, а не в proxy — proxy обрізає великі тіла запитів, а нам треба вантажити AAB.)
 */
export function route<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const ok = await isValidSession(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
      if (!ok) throw new ApiError(401, "Потрібно увійти.");
      const params = ctx?.params ? await ctx.params : ({} as P);
      const data = await fn(req, params);
      return Response.json(data ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  let status = 500;
  let message: string;
  let hint: string | undefined;
  if (e instanceof ApiError) {
    status = e.status;
    message = e.message;
    hint = e.hint;
  } else {
    const code = (e as { code?: number | string; status?: number })?.status ?? Number((e as { code?: unknown })?.code);
    if (Number.isFinite(code) && code >= 400 && code < 600) status = code as number;
    message = googleMessage(e);
    console.error("[google-play]", message);
  }
  return Response.json({ error: humanizeError(status, message, hint) }, { status });
}

export async function jsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Некоректне тіло запиту.");
  }
}
