import { AppsProvider } from "@/components/apps-context";
import { Sidebar } from "@/components/sidebar";
import { authEnabled } from "@/lib/auth";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppsProvider>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar passwordEnabled={authEnabled()} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </AppsProvider>
  );
}
