export interface ImageGenerationRequest {
  prompt: string;
  style: string;
  dimensions: { width: number; height: number }[];
  brandColors: string[];
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  model: string;
}

export async function generateAdImage(
  _request: ImageGenerationRequest
): Promise<GeneratedImage[]> {
  // TODO: Implement with GPT Image 1.5
  // Step 1: Generate base image from prompt
  // Step 2: Resize to each required dimension
  // Step 3: Apply text overlays and brand elements
  throw new Error('Not implemented: AI image generation pipeline');
}
