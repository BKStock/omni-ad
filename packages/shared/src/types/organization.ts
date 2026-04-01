export type PlanTier = 'starter' | 'pro' | 'business' | 'enterprise';

export type UserRole = 'owner' | 'admin' | 'manager' | 'analyst' | 'creative';

export interface Organization {
  id: string;
  name: string;
  plan: PlanTier;
  billingEmail: string;
  createdAt: Date;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
}
