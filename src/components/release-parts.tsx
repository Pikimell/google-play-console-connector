"use client";
import { useRef, useState } from "react";
import { CheckCircle2, FileArchive, Package, Plus, Trash2, UploadCloud } from "lucide-react";
import { Badge, Button, cn, ErrorBox, Field, ProgressBar, Select, Spinner, Textarea } from "./ui";
import { enc, errorInfo, formatBytes, uploadWithProgress } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import type { Bundle, ReleaseNote } from "@/lib/types";
import { LANGUAGES, languageName } from "@/lib/tracks";

export type UploadedBuild = { editId: string; versionCode: number; kind: "aab" | "apk"; size: number; fileName: string };

/** Перетягни файл → він вантажиться в Google Play (в новий edit) → повертає versionCode. */
export function BuildUploader({ pkg, value, onUploaded, onReset }: { pkg: string; value?: UploadedBuild; onUploaded: (b: UploadedBuild) => void; onReset: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [error, setError] = useState<ReturnType<typeof errorInfo>>();

  async function start(f: File) {
    if (!/\.(aab|apk)$/i.test(f.name)) {
      setError({ message: "Потрібен файл .aab або .apk", hint: "Android App Bundle (.aab) — рекомендований формат для Google Play. Зібрати: ./gradlew bundleRelease" });
      return;
    }
    setFile(f);
    setError(undefined);
    setPhase("uploading");
    setProgress(0);
    try {
      const res = await uploadWithProgress<Omit<UploadedBuild, "fileName">>(
        `/api/apps/${enc(pkg)}/upload?filename=${enc(f.name)}`,
        f,
        (p) => {
          setProgress(p);
          if (p >= 1) setPhase("processing");
        },
      );
      onUploaded({ ...res, fileName: f.name });
      setPhase("idle");
    } catch (e) {
      setError(errorInfo(e));
      setPhase("idle");
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="size-8 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-emerald-900">Файл завантажено в Google Play</div>
          <div className="truncate text-sm text-emerald-800">
            {value.fileName} · {formatBytes(value.size)} · <b>versionCode {value.versionCode}</b>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onReset}>Інший файл</Button>
      </div>
    );
  }

  if (phase !== "idle") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-3 flex items-center gap-3">
          <FileArchive className="size-6 text-brand-600" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{file?.name}</div>
            <div className="text-sm text-gray-500">
              {phase === "uploading"
                ? `Відправка на сервер панелі… ${Math.round(progress * 100)}% з ${formatBytes(file?.size ?? 0)}`
                : "Google Play перевіряє та обробляє файл. Для великих збірок це може тривати кілька хвилин — не закривай сторінку."}
            </div>
          </div>
        </div>
        <ProgressBar value={progress} indeterminate={phase === "processing"} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) void start(f);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition",
          drag ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-white hover:border-brand-500 hover:bg-gray-50",
        )}
      >
        <UploadCloud className={cn("mb-3 size-10", drag ? "text-brand-600" : "text-gray-400")} />
        <div className="font-semibold text-gray-900">Перетягни сюди файл .aab або .apk</div>
        <div className="mt-1 text-sm text-gray-500">або натисни, щоб вибрати на комп&apos;ютері</div>
        <div className="mt-3 text-xs text-gray-400">Збірка має бути release-версією, підписаною upload-ключем, з новим versionCode</div>
      </button>
      <input
        ref={input}
        type="file"
        accept=".aab,.apk"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void start(f);
        }}
      />
      <ErrorBox error={error} />
    </div>
  );
}

/** Вибір збірки, яка вже є в Google Play. */
export function ExistingBuildPicker({ pkg, value, onChange }: { pkg: string; value?: number; onChange: (v: number) => void }) {
  const { data, error, loading, reload } = useApi<{ bundles: Bundle[] }>(`/api/apps/${enc(pkg)}/bundles`);
  if (loading) return <Spinner label="Отримую список завантажених збірок…" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const list = data?.bundles ?? [];
  if (!list.length) return <p className="text-sm text-gray-500">У Google Play ще немає жодної завантаженої збірки.</p>;
  return (
    <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
      {list.map((b) => (
        <button
          type="button"
          key={`${b.kind}-${b.versionCode}`}
          onClick={() => onChange(b.versionCode)}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition",
            value === b.versionCode ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-gray-200 bg-white hover:bg-gray-50",
          )}
        >
          <Package className="size-4 text-gray-500" />
          <span className="flex-1 font-medium">versionCode {b.versionCode}</span>
          <Badge>{b.kind.toUpperCase()}</Badge>
        </button>
      ))}
    </div>
  );
}

/** Описи змін («Що нового») для кількох мов. */
export function ReleaseNotesEditor({ value, onChange }: { value: ReleaseNote[]; onChange: (v: ReleaseNote[]) => void }) {
  const [adding, setAdding] = useState("");
  const used = new Set(value.map((n) => n.language));
  return (
    <div className="space-y-4">
      {value.map((n, i) => (
        <Field
          key={n.language}
          label={
            <span className="flex items-center gap-2">
              Що нового · {languageName(n.language)} <span className="font-mono text-xs text-gray-400">{n.language}</span>
              {value.length > 1 && (
                <button type="button" className="text-gray-400 hover:text-red-600" title="Прибрати мову" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </span>
          }
          counter={{ value: n.text.length, max: 500 }}
        >
          <Textarea
            rows={4}
            placeholder={"• Нова функція…\n• Виправлено помилки"}
            value={n.text}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
          />
        </Field>
      ))}
      <div className="flex items-center gap-2">
        <Select value={adding} onChange={(e) => setAdding(e.target.value)} className="max-w-xs">
          <option value="">Додати переклад…</option>
          {LANGUAGES.filter((l) => !used.has(l.code)).map((l) => (
            <option key={l.code} value={l.code}>
              {l.name} ({l.code})
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          icon={<Plus className="size-4" />}
          disabled={!adding}
          onClick={() => {
            onChange([...value, { language: adding, text: "" }]);
            setAdding("");
          }}
        >
          Додати
        </Button>
      </div>
    </div>
  );
}

export function optInLink(pkg: string) {
  return `https://play.google.com/apps/testing/${pkg}`;
}

export function storeLink(pkg: string) {
  return `https://play.google.com/store/apps/details?id=${pkg}`;
}
