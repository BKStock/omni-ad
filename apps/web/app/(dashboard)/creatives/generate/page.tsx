'use client';

import { useState } from 'react';
import { ChevronDown, Image, Loader2, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// -- Types --

type Tone = 'professional' | 'casual' | 'urgent' | 'friendly';
type Platform = 'meta' | 'tiktok' | 'google';

interface GenerateFormValues {
  product_name: string;
  product_description: string;
  target_audience: string;
  tone: Tone;
  platform: Platform;
}

interface CopyResult {
  id: string;
  headline: string;
  body: string;
  cta: string;
  score: number;
  platform: string;
  char_count: { headline: number; body: number; cta: number };
}

interface CopyApiResponse {
  copies: CopyResult[];
}

interface ImageItem {
  id: string;
  url: string;
  size: string;
  style: string;
}

interface ImageApiResponse {
  images: ImageItem[];
}

// -- Constants --

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'プロフェッショナル' },
  { value: 'casual', label: 'カジュアル' },
  { value: 'urgent', label: '緊急感' },
  { value: 'friendly', label: 'フレンドリー' },
];

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'meta', label: 'Meta' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google', label: 'Google' },
];

const DEFAULT_FORM: GenerateFormValues = {
  product_name: '',
  product_description: '',
  target_audience: '',
  tone: 'professional',
  platform: 'meta',
};

// -- Subcomponents --

function ScoreBadge({ score }: { score: number }): React.ReactElement {
  const color =
    score >= 80
      ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      : score >= 60
        ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
        : 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        color,
      )}
    >
      <Star size={10} />
      {score}
    </span>
  );
}

function CopyResultCard({ result }: { result: CopyResult }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">{result.id}</span>
        <ScoreBadge score={result.score} />
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">見出し</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{result.headline}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">本文</p>
          <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">{result.body}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">CTA</p>
          <p className="mt-0.5 text-sm font-medium text-primary">{result.cta}</p>
        </div>
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground border-t border-border pt-2">
        <span>見出し: {result.char_count.headline}文字</span>
        <span>本文: {result.char_count.body}文字</span>
        <span>CTA: {result.char_count.cta}文字</span>
      </div>
    </div>
  );
}

function ImageResultCard({ item }: { item: ImageItem }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="overflow-hidden rounded-md border border-border bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt="生成された広告画像" className="w-full object-cover" />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{item.size}</span>
        <span>{item.style}</span>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

// -- API helpers --

async function fetchCopies(form: GenerateFormValues): Promise<CopyResult[]> {
  const res = await fetch('/api/engine/creative/copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...form, language: 'ja', format: 'feed' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `コピー生成に失敗しました (${res.status})`);
  }
  const data = (await res.json()) as CopyApiResponse;
  return data.copies;
}

async function fetchImages(form: GenerateFormValues): Promise<ImageItem[]> {
  const res = await fetch('/api/engine/creative/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      copy_id: 'manual',
      headline: form.product_name,
      style: 'modern_minimal',
      size: '1080x1080',
      brand_colors: ['#6366f1', '#09090b'],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `画像生成に失敗しました (${res.status})`);
  }
  const data = (await res.json()) as ImageApiResponse;
  return data.images;
}

// -- Main Page --

export default function GeneratePage(): React.ReactElement {
  const [form, setForm] = useState<GenerateFormValues>(DEFAULT_FORM);
  const [copies, setCopies] = useState<CopyResult[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [copyLoading, setCopyLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ): void {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleGenerateCopy(): Promise<void> {
    setCopyLoading(true);
    setCopyError(null);
    try {
      const results = await fetchCopies(form);
      setCopies(results);
    } catch (err: unknown) {
      setCopyError(err instanceof Error ? err.message : 'コピー生成に失敗しました');
    } finally {
      setCopyLoading(false);
    }
  }

  async function handleGenerateImage(): Promise<void> {
    setImageLoading(true);
    setImageError(null);
    try {
      const results = await fetchImages(form);
      setImages(results);
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : '画像生成に失敗しました');
    } finally {
      setImageLoading(false);
    }
  }

  const isFormValid =
    form.product_name.trim() !== '' && form.product_description.trim() !== '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          AIクリエイティブ生成
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          商品情報を入力してAIにコピーと画像を生成させます
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 入力フォーム */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-foreground">商品情報</h2>

          <Field id="product_name" label="商品名" required>
            <input
              id="product_name"
              name="product_name"
              type="text"
              value={form.product_name}
              onChange={handleChange}
              placeholder="例: &AI秘書"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field id="product_description" label="商品説明" required>
            <textarea
              id="product_description"
              name="product_description"
              value={form.product_description}
              onChange={handleChange}
              rows={3}
              placeholder="例: 24時間対応のAI秘書サービス"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field id="target_audience" label="ターゲット">
            <input
              id="target_audience"
              name="target_audience"
              type="text"
              value={form.target_audience}
              onChange={handleChange}
              placeholder="例: 中小企業の経営者"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field id="tone" label="トーン">
              <div className="relative">
                <select
                  id="tone"
                  name="tone"
                  value={form.tone}
                  onChange={handleChange}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TONE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </Field>

            <Field id="platform" label="プラットフォーム">
              <div className="relative">
                <select
                  id="platform"
                  name="platform"
                  value={form.platform}
                  onChange={handleChange}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {PLATFORM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </Field>
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleGenerateCopy()}
              disabled={!isFormValid || copyLoading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copyLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              コピー生成 (10パターン)
            </button>

            <button
              type="button"
              onClick={() => void handleGenerateImage()}
              disabled={!isFormValid || imageLoading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {imageLoading ? <Loader2 size={15} className="animate-spin" /> : <Image size={15} />}
              画像生成 (4パターン)
            </button>
          </div>

          {!isFormValid && (
            <p className="text-xs text-muted-foreground">商品名と商品説明は必須です</p>
          )}
        </div>

        {/* 結果エリア */}
        <div className="space-y-4">
          {/* コピー結果 */}
          {copyLoading && (
            <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AIがコピーを生成中...</p>
            </div>
          )}
          {copyError && !copyLoading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
              <p className="text-sm font-medium text-destructive">コピー生成エラー</p>
              <p className="mt-0.5 text-xs text-destructive/80">{copyError}</p>
            </div>
          )}
          {copies.length > 0 && !copyLoading && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                生成結果 — {copies.length}パターン
              </p>
              {copies.map((c) => (
                <CopyResultCard key={c.id} result={c} />
              ))}
            </div>
          )}

          {/* 画像結果 */}
          {imageLoading && (
            <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AIが画像を生成中...</p>
            </div>
          )}
          {imageError && !imageLoading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
              <p className="text-sm font-medium text-destructive">画像生成エラー</p>
              <p className="mt-0.5 text-xs text-destructive/80">{imageError}</p>
            </div>
          )}
          {images.length > 0 && !imageLoading && (
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">
                生成画像 — {images.length}パターン
              </p>
              <div className="grid grid-cols-2 gap-3">
                {images.map((img) => (
                  <ImageResultCard key={img.id} item={img} />
                ))}
              </div>
            </div>
          )}

          {/* 空状態 */}
          {!copyLoading &&
            !imageLoading &&
            copies.length === 0 &&
            images.length === 0 &&
            !copyError &&
            !imageError && (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card text-muted-foreground">
                <Sparkles size={36} className="text-muted-foreground/30" />
                <p className="text-sm">左のフォームに入力して生成ボタンを押してください</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
