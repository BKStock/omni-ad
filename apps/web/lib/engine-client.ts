/**
 * OMNI AD Engine API client
 * Connects to the FastAPI backend at https://bk-omniad.ngrok.app
 */

const ENGINE_URL =
  process.env.NEXT_PUBLIC_ENGINE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://bk-omniad.ngrok.app';

export class EngineError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

export async function engineFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new EngineError(res.status, `Engine API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ---- Creative endpoints ----

export interface GenerateCopyRequest {
  product_name?: string;
  product_description?: string;
  usp?: string;
  target_audience?: string;
  platforms?: string[];
  variant_count?: number;
  language?: string;
  tone?: string;
}

export interface GeneratedCopy {
  id?: string;
  headline: string;
  description: string;
  platform?: string;
  score?: number;
}

export interface GenerateCopyResponse {
  copies?: GeneratedCopy[];
  variants?: GeneratedCopy[];
  data?: GeneratedCopy[];
}

export async function generateCopy(req: GenerateCopyRequest): Promise<GenerateCopyResponse> {
  return engineFetch<GenerateCopyResponse>('/api/creative/copy', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export interface GenerateImageRequest {
  product_name?: string;
  description?: string;
  platform?: string;
  style?: string;
}

export interface GenerateImageResponse {
  images?: Array<{ url: string; platform?: string }>;
  url?: string;
}

export async function generateImage(req: GenerateImageRequest): Promise<GenerateImageResponse> {
  return engineFetch<GenerateImageResponse>('/api/creative/image', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// ---- Campaign endpoints ----

export interface Campaign {
  id: string;
  name: string;
  status: string;
  platforms?: string[];
  budget?: { total: number; currency: string; dailyLimit?: number };
  roas?: number;
  updatedAt?: string;
  objective?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
}

export interface CampaignsResponse {
  campaigns?: Campaign[];
  data?: Campaign[];
  items?: Campaign[];
}

export async function getCampaigns(): Promise<CampaignsResponse> {
  return engineFetch<CampaignsResponse>('/api/campaigns');
}

export async function createCampaign(data: Partial<Campaign>): Promise<Campaign> {
  return engineFetch<Campaign>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ---- A/B Test endpoints ----

export interface StartABTestRequest {
  name?: string;
  campaign_name?: string;
  metric?: string;
  target?: string;
  days_planned?: number;
  variants?: Array<{ name: string; description: string }>;
}

export interface ABTestResponse {
  id?: string;
  test_id?: string;
  status?: string;
  name?: string;
  [key: string]: unknown;
}

export async function startABTest(req: StartABTestRequest): Promise<ABTestResponse> {
  return engineFetch<ABTestResponse>('/api/ab-test/start', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getABTest(id: string): Promise<ABTestResponse> {
  return engineFetch<ABTestResponse>(`/api/ab-test/${id}`);
}

// ---- Budget endpoints ----

export interface BudgetRotationOption {
  platform?: string;
  current?: number;
  recommended?: number;
  reason?: string;
  expected_roas_lift?: number;
  [key: string]: unknown;
}

export interface BudgetRotationResponse {
  options?: BudgetRotationOption[];
  recommendations?: BudgetRotationOption[];
  data?: BudgetRotationOption[];
}

export async function getBudgetRotationOptions(): Promise<BudgetRotationResponse> {
  return engineFetch<BudgetRotationResponse>('/api/budget/rotation-options');
}

export async function applyMetaBudget(data: {
  campaign_id?: string;
  budget?: number;
  platform?: string;
}): Promise<unknown> {
  return engineFetch('/api/ads/meta/budget', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ---- Cross-platform summary ----

export interface CrossPlatformSummary {
  total_spend?: number;
  total_revenue?: number;
  total_roas?: number;
  active_campaigns?: number;
  total_campaigns?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  [key: string]: unknown;
}

export async function getCrossplatformSummary(): Promise<CrossPlatformSummary> {
  return engineFetch<CrossPlatformSummary>('/api/crossplatform/summary');
}
