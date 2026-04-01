export interface VideoGenerationRequest {
  prompt: string;
  durationSeconds: 6 | 15 | 30;
  imageFrameUrls: string[];
  aspectRatio: '16:9' | '9:16' | '1:1';
}

export interface GeneratedVideo {
  url: string;
  durationSeconds: number;
  aspectRatio: string;
  model: string;
}

export async function generateAdVideo(
  _request: VideoGenerationRequest
): Promise<GeneratedVideo> {
  // TODO: Implement with Runway Gen-3 Alpha
  // Step 1: Send image frames + prompt to Runway API
  // Step 2: Poll for completion
  // Step 3: Post-process with text/CTA overlays
  throw new Error('Not implemented: AI video generation pipeline');
}
