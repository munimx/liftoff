/**
 * App type identifiers used by the Simple Mode wizard.
 */
export const APP_TYPES = ['nextjs', 'django', 'laravel', 'express', 'other'] as const;
export type AppType = (typeof APP_TYPES)[number];

/**
 * Size tier identifiers used by the Simple Mode wizard.
 */
export const SIZE_TIERS = ['small', 'medium', 'large'] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

export interface AppTypeDefaults {
  port: number;
  healthcheckPath: string;
  instanceSize: string;
}

/**
 * Wizard app type → runtime defaults mapping.
 */
export const APP_TYPE_DEFAULTS: Record<AppType, AppTypeDefaults> = {
  nextjs: { port: 3000, healthcheckPath: '/api/health', instanceSize: 'apps-s-1vcpu-1gb' },
  django: { port: 8000, healthcheckPath: '/health/', instanceSize: 'apps-s-1vcpu-1gb' },
  laravel: { port: 80, healthcheckPath: '/up', instanceSize: 'apps-s-1vcpu-1gb' },
  express: { port: 3000, healthcheckPath: '/health', instanceSize: 'apps-s-1vcpu-0.5gb' },
  other: { port: 3000, healthcheckPath: '/health', instanceSize: 'apps-s-1vcpu-0.5gb' },
};

/**
 * Size tier → DO App Platform instance size mapping.
 */
export const SIZE_TIER_INSTANCE_SIZES: Record<SizeTier, string> = {
  small: 'apps-s-1vcpu-0.5gb',
  medium: 'apps-s-1vcpu-1gb',
  large: 'apps-s-2vcpu-4gb',
};

export interface SizeTierInfo {
  label: string;
  description: string;
  priceHint: string;
}

/**
 * Human-readable size tier labels for the wizard UI.
 */
export const SIZE_TIER_INFO: Record<SizeTier, SizeTierInfo> = {
  small: { label: 'Small', description: 'Personal project', priceHint: '~$5/mo' },
  medium: { label: 'Medium', description: 'Small team', priceHint: '~$10/mo' },
  large: { label: 'Large', description: 'Production traffic', priceHint: '~$50/mo' },
};

export interface AppTypeInfo {
  label: string;
  description: string;
}

/**
 * Human-readable app type labels for the wizard UI.
 */
export const APP_TYPE_INFO: Record<AppType, AppTypeInfo> = {
  nextjs: { label: 'Next.js', description: 'React framework' },
  django: { label: 'Django', description: 'Python web framework' },
  laravel: { label: 'Laravel', description: 'PHP framework' },
  express: { label: 'Node/Express', description: 'Node.js server' },
  other: { label: 'Other', description: 'Custom setup' },
};
