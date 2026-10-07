"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { Button, Card, ErrorBox, Input } from "@/components/ui";
import { api, errorInfo } from "@/lib/client";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof errorInfo>>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/login", { method: "POST", json: { password } });
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch (err) {
      setError(errorInfo(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Lock className="size-5" />
          </span>
          <h1 className="text-xl font-semibold">Play Publisher</h1>
          <p className="mt-1 text-sm text-gray-500">Введи пароль панелі (ADMIN_PASSWORD)</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input type="password" autoFocus placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" loading={busy}>Увійти</Button>
        </form>
      </Card>
    </div>
  );
}
