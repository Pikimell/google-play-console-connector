"use client";
import { useParams } from "next/navigation";
import { AppProvider, useApp, useApps } from "@/components/apps-context";
import { AppIcon } from "@/components/app-icon";
import { CopyButton, ErrorBox, Skeleton } from "@/components/ui";

function AppHeader() {
  const { data, pkg, loading, error, reload } = useApp();
  const stored = useApps().data?.apps.find((a) => a.packageName === pkg);
  const o = data?.overview ?? (stored ? { title: stored.title, iconUrl: stored.iconUrl } : undefined);
  return (
    <>
    <div className="mb-6 flex items-center gap-3 border-b border-gray-200 pb-4">
      {loading && !o ? (
        <Skeleton className="size-10" />
      ) : (
        <AppIcon src={o?.iconUrl} name={o?.title || pkg} size={40} />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-gray-900">{o?.title || (loading ? "…" : pkg)}</div>
        <div className="truncate font-mono text-xs text-gray-500">{pkg}</div>
      </div>
      <CopyButton text={pkg} label="Пакет" variant="ghost" />
    </div>
    <ErrorBox error={error} onRetry={reload} className="mb-6" />
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { pkg } = useParams<{ pkg: string }>();
  const packageName = decodeURIComponent(pkg);
  return (
    <AppProvider key={packageName} pkg={packageName}>
      <AppHeader />
      {children}
    </AppProvider>
  );
}
