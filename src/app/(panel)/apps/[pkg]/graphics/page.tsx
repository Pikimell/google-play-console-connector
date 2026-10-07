"use client";
import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useApp } from "@/components/apps-context";
import { Button, Card, ErrorBox, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { api, enc, errorInfo, uploadWithProgress } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import { languageName } from "@/lib/tracks";
import type { ImageType, Listing, StoreImage } from "@/lib/types";

const TYPES: { type: ImageType; title: string; spec: string; max: number; wide?: boolean }[] = [
  { type: "icon", title: "Іконка", spec: "PNG 512×512, до 1 МБ", max: 1 },
  { type: "featureGraphic", title: "Головне зображення", spec: "PNG/JPEG 1024×500", max: 1, wide: true },
  { type: "phoneScreenshots", title: "Скриншоти телефона", spec: "2–8 шт., PNG/JPEG, сторона 320–3840 px, пропорції до 2:1", max: 8 },
  { type: "sevenInchScreenshots", title: "Скриншоти планшета 7\"", spec: "до 8 шт.", max: 8 },
  { type: "tenInchScreenshots", title: "Скриншоти планшета 10\"", spec: "до 8 шт.", max: 8 },
  { type: "tvBanner", title: "Банер Android TV", spec: "1280×720", max: 1, wide: true },
  { type: "tvScreenshots", title: "Скриншоти Android TV", spec: "до 8 шт.", max: 8 },
  { type: "wearScreenshots", title: "Скриншоти Wear OS", spec: "до 8 шт.", max: 8 },
];

function ImageSection({ pkg, language, spec, images, onChanged }: { pkg: string; language: string; spec: (typeof TYPES)[number]; images: StoreImage[]; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const base = `/api/apps/${enc(pkg)}/images?language=${enc(language)}&type=${spec.type}`;

  async function upload(files: FileList) {
    const list = [...files].slice(0, Math.max(1, spec.max - (spec.max === 1 ? 0 : images.length)));
    try {
      for (const [i, f] of list.entries()) {
        setBusy(`Завантаження ${i + 1}/${list.length}…`);
        await uploadWithProgress(base, f, () => {}, f.type);
      }
      toast("success", "Зображення завантажено");
      await onChanged();
    } catch (e) {
      const info = errorInfo(e);
      toast("error", info.hint ? `${info.message} ${info.hint}` : info.message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Видалити зображення з Google Play?")) return;
    setBusy("Видалення…");
    try {
      await api(`${base}&id=${enc(id)}`, { method: "DELETE" });
      await onChanged();
    } catch (e) {
      toast("error", errorInfo(e).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{spec.title} <span className="text-sm font-normal text-gray-400">{images.length}/{spec.max}</span></h2>
          <p className="text-xs text-gray-500">{spec.spec}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          disabled={!!busy || (spec.max > 1 && images.length >= spec.max)}
          onClick={() => input.current?.click()}
        >
          {busy ?? (spec.max === 1 && images.length ? "Замінити" : "Завантажити")}
        </Button>
        <input ref={input} type="file" accept="image/png,image/jpeg" multiple={spec.max > 1} className="hidden" onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
      </div>
      {images.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((img) => (
            <div key={img.id} className="group relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${img.url}=h${spec.wide ? 160 : 320}`} alt="" className={`rounded-lg border border-gray-200 object-cover ${spec.type === "icon" ? "size-24" : spec.wide ? "h-24" : "h-48"}`} />
              <button onClick={() => remove(img.id)} className="absolute top-1.5 right-1.5 hidden rounded-md bg-white/90 p-1 text-red-600 shadow group-hover:block" aria-label="Видалити">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Немає зображень.</p>
      )}
    </Card>
  );
}

export default function GraphicsPage() {
  const { pkg, data: app, reload: reloadApp } = useApp();
  const listings = useApi<{ defaultLanguage?: string; listings: Listing[] }>(`/api/apps/${enc(pkg)}/listings`);
  const [language, setLanguage] = useState<string>();
  const lang = language ?? listings.data?.defaultLanguage ?? app?.overview.defaultLanguage;
  const images = useApi<{ images: Record<ImageType, StoreImage[]> }>(lang ? `/api/apps/${enc(pkg)}/images?language=${enc(lang)}` : null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? TYPES : TYPES.slice(0, 3);

  return (
    <>
      <PageHeader
        title="Графіка"
        description="Іконка, головне зображення і скриншоти для сторінки в Google Play."
        actions={
          listings.data && (
            <Select value={lang} onChange={(e) => setLanguage(e.target.value)} className="w-56">
              {listings.data.listings.map((l) => <option key={l.language} value={l.language}>{languageName(l.language)}</option>)}
            </Select>
          )
        }
      />
      <ErrorBox error={listings.error ?? images.error} onRetry={() => { void listings.reload(); void images.reload(); }} className="mb-4" />
      {images.loading && !images.data ? (
        <div className="space-y-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-56" /></div>
      ) : images.data && lang ? (
        <div className="space-y-4">
          {visible.map((t) => (
            <ImageSection key={t.type} pkg={pkg} language={lang} spec={t} images={images.data!.images[t.type] ?? []} onChanged={async () => { await images.reload(); if (t.type === "icon") void reloadApp(); }} />
          ))}
          <Button variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? "Сховати планшети, TV, Wear" : "Показати планшети, TV, Wear OS"}</Button>
        </div>
      ) : null}
    </>
  );
}
