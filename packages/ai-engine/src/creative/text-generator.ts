export interface TextGenerationRequest {
  productName: string;
  productDescription: string;
  targetAudience: string;
  usp: string;
  platform: string;
  language: 'ja' | 'en';
  keigoLevel: 'casual' | 'polite' | 'formal';
  maxHeadlineLength: number;
  maxBodyLength: number;
  variantCount: number;
}

export interface GeneratedText {
  headline: string;
  body: string;
  cta: string;
  variant: number;
  model: string;
}

export async function generateAdText(
  _request: TextGenerationRequest
): Promise<GeneratedText[]> {
  // TODO: Implement with Claude API (Japanese) and GPT-4o (English)
  // Step 1: Generate creative brief via Claude
  // Step 2: Generate text variants conditioned on platform specs
  // Step 3: Validate character counts (full-width aware)
  // Step 4: Return ranked variants
  throw new Error('Not implemented: AI text generation pipeline');
}
