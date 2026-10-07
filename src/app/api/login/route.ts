import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

const MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return Response.json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (body.password !== password) {
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: { status: 401, message: "Невірний пароль." } }, { status: 401 });
  }
  const token = await sessionToken(password);
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}` } },
  );
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0` } });
}
