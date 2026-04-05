# &AI AD

> Meta / TikTok / X の広告を一元管理し、AIが自動でクリエイティブ生成・入札最適化・レポートを実行するマーケティング自動化プラットフォーム

## 🎯 概要

3大SNS広告（Meta・TikTok・X）をシングルダッシュボードで統合管理。
AIがクリエイティブ生成からA/Bテスト・入札最適化まで自動化し、広告運用コストを大幅削減する。
中国MarTech連携など越境マーケティングにも対応。

## ✨ 主な機能

- **マルチチャネル統合管理** — Meta/TikTok/X広告を一画面で運用
- **AIクリエイティブ生成** — 画像・動画・コピーを自動生成（OpenAI + Claude）
- **自動A/Bテスト** — クリエイティブとオーディエンスを継続的に最適化
- **インテリジェント入札** — 予算配分をリアルタイム最適化
- **自動パフォーマンスレポート** — AI診断付きインサイトを自動生成

## 🛠️ 技術スタック

- **フロントエンド:** Next.js 15 + TypeScript + Tailwind CSS + tRPC + TanStack Query
- **バックエンド:** Fastify 5 + tRPC + Node.js 20+
- **ワーカー:** BullMQ 5（Redisバックエンド）でバックグラウンド処理
- **DB:** PostgreSQL 17 + pgvector + Drizzle ORM
- **キャッシュ:** Redis 7
- **インフラ:** Vercel（フロント）+ Docker（DB/Cache）+ Turborepo（モノレポ）

## 🌐 URL

- **本番:** https://bk-omniad.ngrok.app
- **開発:** http://localhost:3000（フロント）/ http://localhost:3001（API）

## 📊 ステータス

🟢 稼働中 — 中国MarTech Phase 1 実装済み・Claudeによる広告アカウント診断対応

## 🔗 関連プロジェクト

- **統合元:** omni-ad（sns-account-engine・bk-x-automation統合スイート）
- **連携先:** &AI BRAIN（市場インサイト連携）、&AI SENSE（BI連携）

## 📁 プロジェクト構造

```
apps/
├── web/            # Next.js フロントエンド（Port 3000）
├── api/            # Fastify API サーバー（Port 3001）
└── worker/         # BullMQ バックグラウンドワーカー
packages/
├── db/             # Drizzle ORM スキーマ・マイグレーション
├── auth/           # 認証ユーティリティ
├── platform-adapters/  # Meta/TikTok/X API アダプター
├── ai-engine/      # AIクリエイティブ生成エンジン
├── queue/          # BullMQ キュー管理
├── shared/         # 共通型・バリデーター・定数
└── ui/             # 再利用可能UIコンポーネント
```

## 🚀 開始方法

```bash
# 前提: Node.js 20+, pnpm 9+, Docker

# 依存関係インストール
pnpm install

# インフラ起動（PostgreSQL + Redis）
docker compose up -d

# DBマイグレーション
pnpm db:migrate

# 全サービス開発モード起動
pnpm dev
```

### 環境変数

```env
DATABASE_URL=postgresql://localhost:5432/omni_ad
REDIS_HOST=localhost
REDIS_PORT=6379
META_APP_ID=
META_APP_SECRET=
TIKTOK_APP_ID=
X_CONSUMER_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

---
*BKグループ &AI ブランド / 2026-04-06*
