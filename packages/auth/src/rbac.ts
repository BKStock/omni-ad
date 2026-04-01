export const USER_ROLES = ['owner', 'admin', 'manager', 'analyst', 'creative'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = [
  'org:manage',
  'org:billing',
  'org:delete',
  'users:manage',
  'users:view',
  'campaigns:create',
  'campaigns:edit',
  'campaigns:delete',
  'campaigns:view',
  'campaigns:deploy',
  'budgets:manage',
  'budgets:view',
  'creatives:create',
  'creatives:edit',
  'creatives:view',
  'audiences:manage',
  'audiences:view',
  'analytics:view',
  'analytics:export',
  'reports:generate',
  'reports:view',
  'funnels:manage',
  'funnels:view',
  'platforms:connect',
  'platforms:disconnect',
  'platforms:view',
  'audit:view',
  'settings:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: [
    'users:manage',
    'users:view',
    'campaigns:create',
    'campaigns:edit',
    'campaigns:delete',
    'campaigns:view',
    'campaigns:deploy',
    'budgets:manage',
    'budgets:view',
    'creatives:create',
    'creatives:edit',
    'creatives:view',
    'audiences:manage',
    'audiences:view',
    'analytics:view',
    'analytics:export',
    'reports:generate',
    'reports:view',
    'funnels:manage',
    'funnels:view',
    'platforms:connect',
    'platforms:disconnect',
    'platforms:view',
    'audit:view',
    'settings:manage',
  ],
  manager: [
    'users:view',
    'campaigns:create',
    'campaigns:edit',
    'campaigns:view',
    'campaigns:deploy',
    'budgets:view',
    'creatives:create',
    'creatives:edit',
    'creatives:view',
    'audiences:manage',
    'audiences:view',
    'analytics:view',
    'analytics:export',
    'reports:generate',
    'reports:view',
    'funnels:manage',
    'funnels:view',
    'platforms:view',
  ],
  analyst: [
    'campaigns:view',
    'budgets:view',
    'creatives:view',
    'audiences:view',
    'analytics:view',
    'analytics:export',
    'reports:view',
    'funnels:view',
    'platforms:view',
  ],
  creative: [
    'campaigns:view',
    'creatives:create',
    'creatives:edit',
    'creatives:view',
    'analytics:view',
    'platforms:view',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissions(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function canAccessRoute(role: UserRole, requiredPermissions: Permission[]): boolean {
  return requiredPermissions.every((p) => hasPermission(role, p));
}
