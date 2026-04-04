import { type VideoScript, type VideoScene } from '@omni-ad/shared';

export interface ScriptGenerationRequest {
  productName: string;
  productDescription: string;
  targetAudience: string;
  goal: string;
  durationSeconds: number;
  language: 'ja' | 'en';
  keigoLevel: 'casual' | 'polite' | 'formal';
  platform: string;
  brandColors?: string[];
}

const KEIGO_INSTRUCTIONS: Record<ScriptGenerationRequest['keigoLevel'], string> = {
  casual: 'タメ口で親しみやすいトーン',
  polite: 'です・ます調の丁寧なトーン',
  formal: '敬語を使った格式のあるトーン',
};

const PLATFORM_CONTEXT: Record<string, string> = {
  TIKTOK: 'TikTok — 縦型9:16、テンポ速め、フック重要',
  DOUYIN: 'Douyin — 縦型9:16、エンタメ性高め、短尺推奨',
  INSTAGRAM: 'Instagram Reels — 縦型9:16、ビジュアル重視',
  YOUTUBE: 'YouTube — 横型16:9、詳細説明OK',
  META: 'Facebook/Instagram — 横型・縦型両対応',
};

// Claude tool-use スキーマ（構造化出力）
const SCRIPT_TOOL_SCHEMA = {
  name: 'output_video_script',
  description: 'Output a structured video ad script',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Script title' },
      duration: { type: 'number', description: 'Total duration in seconds' },
      scenes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            order: { type: 'number' },
            duration: { type: 'number' },
            description: { type: 'string' },
            textOverlay: { type: 'string' },
            transition: { type: 'string', enum: ['cut', 'fade', 'slide', 'zoom'] },
            visualStyle: {
              type: 'string',
              enum: ['product-focus', 'lifestyle', 'testimonial', 'text-heavy'],
            },
          },
          required: ['order', 'duration', 'description', 'transition', 'visualStyle'],
        },
      },
      voiceover: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          language: { type: 'string' },
          style: { type: 'string' },
        },
        required: ['text', 'language', 'style'],
      },
      music: {
        type: 'object',
        properties: {
          mood: { type: 'string' },
          tempo: { type: 'string' },
        },
        required: ['mood', 'tempo'],
      },
      callToAction: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          position: { type: 'string' },
        },
        required: ['text', 'position'],
      },
    },
    required: ['title', 'duration', 'scenes', 'voiceover', 'music', 'callToAction'],
  },
};

function buildSystemPrompt(req: ScriptGenerationRequest): string {
  const platformCtx = PLATFORM_CONTEXT[req.platform.toUpperCase()] ?? req.platform;
  const sceneCount = Math.max(2, Math.round(req.durationSeconds / 5));

  if (req.language === 'ja') {
    const keigoInstruction = KEIGO_INSTRUCTIONS[req.keigoLevel];
    return [
      `あなたは動画広告スクリプトの専門家です。`,
      `プラットフォーム: ${platformCtx}`,
      `トーン: ${keigoInstruction}`,
      `合計尺: ${req.durationSeconds}秒`,
      `シーン数: 約${sceneCount}シーン（各シーンは3〜8秒）`,
      `目標: ${req.goal}`,
      `ターゲット: ${req.targetAudience}`,
      `シーンの合計時間がdurationと一致するよう必ず調整してください。`,
      `各シーンのvisualStyleはproduct-focus/lifestyle/testimonial/text-heavyから選択してください。`,
    ].join('\n');
  }

  return [
    `You are a video ad script expert.`,
    `Platform: ${platformCtx}`,
    `Total duration: ${req.durationSeconds}s`,
    `Target scene count: ~${sceneCount} scenes (3-8s each)`,
    `Goal: ${req.goal}`,
    `Target audience: ${req.targetAudience}`,
    `Ensure all scene durations sum to the total duration.`,
    `Use product-focus/lifestyle/testimonial/text-heavy for visualStyle.`,
  ].join('\n');
}

function buildUserPrompt(req: ScriptGenerationRequest): string {
  const lines = [
    `Product: ${req.productName}`,
    `Description: ${req.productDescription}`,
    `Target audience: ${req.targetAudience}`,
    `Goal: ${req.goal}`,
    `Duration: ${req.durationSeconds}s`,
  ];
  if (req.brandColors && req.brandColors.length > 0) {
    lines.push(`Brand colors: ${req.brandColors.join(', ')}`);
  }
  return lines.join('\n');
}

interface RawScriptOutput {
  title: string;
  duration: number;
  scenes: {
    order: number;
    duration: number;
    description: string;
    textOverlay?: string;
    transition: string;
    visualStyle: string;
  }[];
  voiceover: { text: string; language: string; style: string };
  music: { mood: string; tempo: string };
  callToAction: { text: string; position: string };
}

function parseClaudeToolOutput(responseBody: unknown): RawScriptOutput {
  const body = responseBody as Record<string, unknown>;
  const content = body['content'] as unknown[];
  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (b['type'] === 'tool_use' && b['name'] === 'output_video_script') {
      return b['input'] as RawScriptOutput;
    }
  }
  throw new Error('Claude response did not include tool_use block for output_video_script');
}

function normalizeScript(raw: RawScriptOutput): VideoScript {
  const scenes: VideoScene[] = raw.scenes.map((s) => ({
    order: s.order,
    duration: s.duration,
    description: s.description,
    textOverlay: s.textOverlay,
    transition: s.transition as VideoScene['transition'],
    visualStyle: s.visualStyle as VideoScene['visualStyle'],
  }));

  return {
    title: raw.title,
    duration: raw.duration,
    scenes,
    voiceover: raw.voiceover,
    music: raw.music,
    callToAction: raw.callToAction,
  };
}

export async function generateVideoScript(
  request: ScriptGenerationRequest,
): Promise<VideoScript> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const systemPrompt = buildSystemPrompt(request);
  const userPrompt = buildUserPrompt(request);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [SCRIPT_TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'output_video_script' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  const raw = parseClaudeToolOutput(body);
  return normalizeScript(raw);
}
