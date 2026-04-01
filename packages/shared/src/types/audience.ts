import { type Platform } from './platform.js';

export interface AudienceRule {
  field: string;
  operator: 'is' | 'is_not' | 'contains' | 'gt' | 'lt';
  value: string | number;
}

export interface AudienceDefinition {
  type: 'custom' | 'lookalike' | 'saved';
  source: string | null;
  rules: AudienceRule[];
}

export interface AudienceSegment {
  id: string;
  organizationId: string;
  name: string;
  platform: Platform;
  externalId: string | null;
  size: number;
  definition: AudienceDefinition;
}

export interface AudienceOverlap {
  segmentAId: string;
  segmentBId: string;
  overlapPercentage: number;
  computedAt: Date;
}
