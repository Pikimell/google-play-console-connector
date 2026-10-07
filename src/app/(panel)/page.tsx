"use client";
import Link from "next/link";
import { ArrowRight, FlaskConical, Plus, Rocket, Settings, Smartphone, Users } from "lucide-react";
import { useApps } from "@/components/apps-context";
import { AppIcon } from "@/components/app-icon";
import { Alert, Card, EmptyState, ErrorBox, LinkButton, PageHeader, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { enc } from "@/lib/client";

type Status = { credentials: { ok: boolean; error?: string; email?: string }; passwordEnabled: boolean; appsCount: number };

const ACTIONS = [
  { href: "/apps/{pkg}/release", icon: Rocket, title: "Завантажити нову версію", text: "AAB/APK → вибір треку → опис змін → публікація", needsApp: true },
  { href: "/apps/{pkg}/testing/new", icon: FlaskConical, title: "Нове закрите тестування", text: "Створити трек, додати тестувальників і збірку", needsApp: true },
  { href: "/testers", icon: Users, title: "Тестувальники", text: "Списки email-адрес і Google-групи", needsApp: false },
  { href: "/apps/new", icon: Plus, title: "Додати застосунок", text: "Новий або вже наявний у Play Console", needsApp: false },
];

export default function Dashboard() {
  const { data, loading, error, reload } = useApps();
  const status = useApi<Status>("/api/status");
  const apps = data?.apps ?? [];
  const first = apps[0]?.packageName;

  return (
    <>
      <PageHeader title="Головна" description="Що будемо робити сьогодні?" />

      {status.data && !status.data.credentials.ok && (
        <Alert
          tone="warning"
          className="mb-6"
          title="Панель ще не підключена до Google Play"
          action={<LinkButton href="/setup" size="sm" icon={<Settings className="size-4" />}>Налаштувати</LinkButton>}
        >
          {status.data.credentials.error} Відкрий «Підключення» — там кілька простих кроків.
        </Alert>
      )}

      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((a) => {
          const disabled = a.needsApp && !first;
          const href = a.href.replace("{pkg}", enc(first ?? ""));
          const body = (
            <Card className={`h-full p-4 transition ${disabled ? "opacity-50" : "hover:border-brand-500 hover:shadow-md"}`}>
              <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <a.icon className="size-5" />
              </span>
              <div className="font-semibold text-gray-900">{a.title}</div>
              <div className="mt-1 text-sm text-gray-500">{a.text}</div>
              {a.needsApp && apps.length > 1 && <div className="mt-2 text-xs text-gray-400">Для: {apps[0].title || first} (або вибери застосунок нижче)</div>}
            </Card>
          );
          return disabled ? <div key={a.title}>{body}</div> : <Link key={a.title} href={href}>{body}</Link>;
        })}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Мої застосунки</h2>
        <LinkButton href="/apps/new" variant="secondary" size="sm" icon={<Plus className="size-4" />}>Додати</LinkButton>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="size-10" />}
          title="Ще немає жодного застосунку"
          action={<LinkButton href="/apps/new" icon={<Plus className="size-4" />}>Додати перший застосунок</LinkButton>}
        >
          Google не дає API, щоб отримати список усіх застосунків акаунта, тому їх треба один раз додати сюди за назвою пакета.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {apps.map((a) => {
            const base = `/apps/${enc(a.packageName)}`;
            return (
              <Card key={a.packageName} className="p-4">
                <Link href={base} className="group flex items-center gap-3">
                  <AppIcon src={a.iconUrl} name={a.title || a.packageName} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-gray-900 group-hover:text-brand-700">{a.title || a.packageName}</div>
                    <div className="truncate font-mono text-xs text-gray-500">{a.packageName}</div>
                  </div>
                  <ArrowRight className="size-4 text-gray-400 group-hover:text-brand-600" />
                </Link>
                <div className="mt-4 flex flex-wrap gap-2">
                  <LinkButton href={`${base}/release`} size="sm" icon={<Rocket className="size-4" />}>Нова версія</LinkButton>
                  <LinkButton href={`${base}/testing`} size="sm" variant="secondary" icon={<FlaskConical className="size-4" />}>Тестування</LinkButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
