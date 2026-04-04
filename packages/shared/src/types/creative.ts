import { type Platform } from './platform.js';

export interface VideoScene {
  order: number;
  duration: number;
  description: string;
  textOverlay?: string;
  transition: 'cut' | 'fade' | 'slide' | 'zoom';
  visualStyle: 'product-focus' | 'lifestyle' | 'testimonial' | 'text-heavy';
}

export interface VideoScript {
  title: string;
  duration: number;
  scenes: VideoScene[];
  voiceover: { text: string; language: string; style: string };
  music: { mood: string; tempo: string };
  callToAction: { text: string; position: string };
}

export type CreativeType = 'text' | 'image' | 'video' | 'carousel';

export interface CreativeContent {
  headline: string;
  body: string;
  cta: string;
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
}

export interface Creative {
  id: string;
  organizationId: string;
  type: CreativeType;
  baseContent: CreativeContent;
  aiGenerated: boolean;
  promptUsed: string | null;
  modelUsed: string | null;
  performanceScore: number | null;
  createdAt: Date;
}

export interface CreativeVariant {
  id: string;
  creativeId: string;
  platform: Platform;
  adaptedContent: CreativeContent;
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  fileUrl: string | null;
}

export interface PlatformCreativeSpecs {
  platform: Platform;
  maxHeadlineLength: number;
  maxBodyLength: number;
  supportedFormats: string[];
  dimensions: {
    name: string;
    width: number;
    height: number;
  }[];
  maxFileSizeMb: number;
  maxVideoDurationSeconds: number | null;
}
