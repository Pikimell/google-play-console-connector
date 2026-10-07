"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useApi, type Loadable } from "@/lib/hooks";
import type { AppOverview, StoredApp } from "@/lib/types";

const AppsCtx = createContext<Loadable<{ apps: StoredApp[] }> | null>(null);

/** Список застосунків панелі (для меню та головної). */
export function AppsProvider({ children }: { children: ReactNode }) {
  const value = useApi<{ apps: StoredApp[] }>("/api/apps");
  return <AppsCtx.Provider value={value}>{children}</AppsCtx.Provider>;
}

export function useApps() {
  const v = useContext(AppsCtx);
  if (!v) throw new Error("AppsProvider missing");
  return v;
}

type AppValue = Loadable<{ overview: AppOverview; saved: boolean }> & { pkg: string };
const AppCtx = createContext<AppValue | null>(null);

/** Дані поточного застосунку (треки, назва) — спільні для всіх його сторінок. */
export function AppProvider({ pkg, children }: { pkg: string; children: ReactNode }) {
  const value = useApi<{ overview: AppOverview; saved: boolean }>(`/api/apps/${encodeURIComponent(pkg)}`);
  return <AppCtx.Provider value={{ ...value, pkg }}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error("AppProvider missing");
  return v;
}
