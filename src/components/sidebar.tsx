"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, CreditCard, FileText, FlaskConical, Home, Languages, Image as ImageIcon, LogOut, Menu, MessageSquare, Plus, Rocket, Settings, Settings2, Users, Layers, X,
} from "lucide-react";
import { useApps } from "./apps-context";
import { AppIcon } from "./app-icon";
import { cn } from "./ui";

export const APP_NAV = [
  { href: "", label: "Огляд", icon: BarChart3 },
  { href: "/release", label: "Нова версія", icon: Rocket },
  { href: "/tracks", label: "Релізи й треки", icon: Layers },
  { href: "/testing", label: "Закрите тестування", icon: FlaskConical },
  { href: "/listing", label: "Опис у магазині", icon: FileText },
  { href: "/localize", label: "Локалізація", icon: Languages },
  { href: "/graphics", label: "Графіка", icon: ImageIcon },
  { href: "/details", label: "Контакти", icon: Settings2 },
  { href: "/subscriptions", label: "Підписки", icon: CreditCard },
  { href: "/reviews", label: "Відгуки", icon: MessageSquare },
];

function NavLink({ href, active, icon: Icon, children, onClick }: { href: string; active: boolean; icon: typeof Home; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-brand-50 font-semibold text-brand-700" : "text-gray-700 hover:bg-gray-100",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
    </Link>
  );
}

export function Sidebar({ passwordEnabled }: { passwordEnabled: boolean }) {
  const pathname = usePathname();
  const { data } = useApps();
  const [open, setOpen] = useState(false);
  const apps = data?.apps ?? [];
  const m = pathname.match(/^\/apps\/([^/]+)(\/[^/]+)?/);
  const currentPkg = m && m[1] !== "new" ? decodeURIComponent(m[1]) : null;
  const currentSection = m?.[2] ?? "";
  const close = () => setOpen(false);

  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <Link href="/" onClick={close} className="flex items-center gap-2.5 px-2 pt-1">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Rocket className="size-4" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-gray-900">Play Publisher</span>
          <span className="block text-xs text-gray-500">керування Google Play</span>
        </span>
      </Link>

      <div className="space-y-1">
        <NavLink href="/" active={pathname === "/"} icon={Home} onClick={close}>Головна</NavLink>
        <NavLink href="/testers" active={pathname.startsWith("/testers")} icon={Users} onClick={close}>Тестувальники</NavLink>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-3">
          <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Застосунки</span>
          <Link href="/apps/new" onClick={close} className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800" title="Додати застосунок">
            <Plus className="size-4" />
          </Link>
        </div>
        <div className="space-y-1">
          {apps.map((a) => {
            const active = currentPkg === a.packageName;
            const base = `/apps/${encodeURIComponent(a.packageName)}`;
            return (
              <div key={a.packageName}>
                <Link
                  href={base}
                  onClick={close}
                  className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition", active ? "bg-gray-100" : "hover:bg-gray-100")}
                >
                  <AppIcon src={a.iconUrl} name={a.title || a.packageName} size={26} />
                  <span className="min-w-0">
                    <span className={cn("block truncate", active ? "font-semibold text-gray-900" : "text-gray-800")}>{a.title || a.packageName}</span>
                    {a.title && <span className="block truncate text-[11px] text-gray-500">{a.packageName}</span>}
                  </span>
                </Link>
                {active && (
                  <div className="mt-1 mb-2 ml-4 space-y-0.5 border-l border-gray-200 pl-2">
                    {APP_NAV.map((n) => (
                      <NavLink key={n.href} href={base + n.href} active={currentSection === n.href} icon={n.icon} onClick={close}>
                        {n.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <NavLink href="/apps/new" active={pathname === "/apps/new"} icon={Plus} onClick={close}>Додати застосунок</NavLink>
        </div>
      </div>

      <div className="mt-auto space-y-1 border-t border-gray-100 pt-4">
        <NavLink href="/setup" active={pathname === "/setup"} icon={Settings} onClick={close}>Підключення</NavLink>
        {passwordEnabled && (
          <button
            onClick={async () => {
              await fetch("/api/login", { method: "DELETE" });
              window.location.href = "/login";
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <LogOut className="size-4" /> Вийти
          </button>
        )}
      </div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-md p-1 text-gray-700 hover:bg-gray-100" aria-label="Меню">
          <Menu className="size-5" />
        </button>
        <span className="text-sm font-semibold">Play Publisher</span>
      </div>
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-gray-200 bg-white lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/40" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button onClick={close} className="absolute top-4 right-3 rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label="Закрити">
              <X className="size-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
