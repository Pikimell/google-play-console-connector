"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { CsvButton, GoogleGroupGuide, TesterGroupForm } from "@/components/tester-groups";
import { Badge, Button, Card, CopyButton, EmptyState, ErrorBox, Modal, PageHeader, Skeleton, useToast } from "@/components/ui";
import { api, formatDate } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import type { TesterGroup } from "@/lib/types";

export default function TestersPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ groups: TesterGroup[] }>("/api/tester-groups");
  const [editing, setEditing] = useState<TesterGroup | "new" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const groups = data?.groups ?? [];

  async function remove(g: TesterGroup) {
    if (!confirm(`Видалити групу «${g.name}» з панелі? Google-група і треки в Play Console не зміняться.`)) return;
    await api(`/api/tester-groups/${g.id}`, { method: "DELETE" });
    toast("success", "Групу видалено");
    void reload();
  }

  return (
    <>
      <PageHeader
        title="Тестувальники"
        description="Списки email-адрес, які можна використовувати в будь-якому застосунку і треку тестування."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Нова група</Button>}
      />
      <GoogleGroupGuide />
      <div className="mt-6">
        <ErrorBox error={error} onRetry={reload} />
        {loading && !data ? (
          <Skeleton className="h-24" />
        ) : groups.length === 0 ? (
          <EmptyState icon={<Users className="size-10" />} title="Груп ще немає" action={<Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Створити першу групу</Button>}>
            Створи групу, встав email-и тестувальників — і прив&apos;язуй її до будь-якого закритого тестування.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <Card key={g.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{g.name}</span>
                      <Badge tone="gray">{g.emails.length} email</Badge>
                      {g.googleGroup ? <Badge tone="green">Google-група</Badge> : <Badge tone="amber">без Google-групи</Badge>}
                    </div>
                    {g.googleGroup && <div className="mt-0.5 font-mono text-xs text-gray-500">{g.googleGroup}</div>}
                    <div className="mt-0.5 text-xs text-gray-400">Оновлено {formatDate(g.updatedAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <CopyButton text={g.emails.join(", ")} label="Копіювати email-и" />
                    <CsvButton name={g.name} emails={g.emails} label="CSV" />
                    <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(g)}>Змінити</Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => remove(g)} aria-label="Видалити" />
                  </div>
                </div>
                {g.emails.length > 0 && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(expanded === g.id ? g.emails : g.emails.slice(0, 8)).map((e) => (
                        <span key={e} className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">{e}</span>
                      ))}
                      {g.emails.length > 8 && (
                        <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
                          {expanded === g.id ? "згорнути" : `+ ще ${g.emails.length - 8}`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Нова група тестувальників" : "Редагувати групу"} wide>
        {editing && (
          <TesterGroupForm
            initial={editing === "new" ? undefined : editing}
            submitLabel={editing === "new" ? "Створити групу" : "Зберегти"}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              toast("success", "Групу збережено");
              void reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}
