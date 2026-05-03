/**
 * Canonical deployment status values for deployment state transitions.
 */
export const DeploymentStatus = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  BUILDING: 'BUILDING',
  PUSHING: 'PUSHING',
  PROVISIONING: 'PROVISIONING',
  DEPLOYING: 'DEPLOYING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  ROLLING_BACK: 'ROLLING_BACK',
  ROLLED_BACK: 'ROLLED_BACK',
  CANCELLED: 'CANCELLED',
} as const;

export type DeploymentStatusType =
  (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const TERMINAL_STATUSES: DeploymentStatusType[] = [
  DeploymentStatus.SUCCESS,
  DeploymentStatus.FAILED,
  DeploymentStatus.ROLLED_BACK,
  DeploymentStatus.CANCELLED,
];

export const ACTIVE_STATUSES: DeploymentStatusType[] = [
  DeploymentStatus.QUEUED,
  DeploymentStatus.BUILDING,
  DeploymentStatus.PUSHING,
  DeploymentStatus.PROVISIONING,
  DeploymentStatus.DEPLOYING,
  DeploymentStatus.ROLLING_BACK,
];

/**
 * Plain English labels for Simple Mode status page.
 */
export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatusType, string> = {
  [DeploymentStatus.PENDING]: 'Getting ready...',
  [DeploymentStatus.QUEUED]: 'Getting ready...',
  [DeploymentStatus.BUILDING]: 'Building your app (step 1/4)',
  [DeploymentStatus.PUSHING]: 'Packaging your app (step 2/4)',
  [DeploymentStatus.PROVISIONING]: 'Setting up your server (step 3/4)',
  [DeploymentStatus.DEPLOYING]: 'Making it live (step 4/4)',
  [DeploymentStatus.SUCCESS]: 'Your app is live!',
  [DeploymentStatus.FAILED]: "Something went wrong — we'll help you fix it",
  [DeploymentStatus.ROLLING_BACK]: 'Rolling back to a previous version...',
  [DeploymentStatus.ROLLED_BACK]: 'Rolled back to a previous version',
  [DeploymentStatus.CANCELLED]: 'Deployment was cancelled',
};

/**
 * Step number for the Simple Mode progress bar (0 = not started, 4 = done).
 */
export const DEPLOYMENT_STATUS_STEP: Record<DeploymentStatusType, number> = {
  [DeploymentStatus.PENDING]: 0,
  [DeploymentStatus.QUEUED]: 0,
  [DeploymentStatus.BUILDING]: 1,
  [DeploymentStatus.PUSHING]: 2,
  [DeploymentStatus.PROVISIONING]: 3,
  [DeploymentStatus.DEPLOYING]: 4,
  [DeploymentStatus.SUCCESS]: 4,
  [DeploymentStatus.FAILED]: 0,
  [DeploymentStatus.ROLLING_BACK]: 0,
  [DeploymentStatus.ROLLED_BACK]: 0,
  [DeploymentStatus.CANCELLED]: 0,
};

export const VALID_TRANSITIONS: Record<DeploymentStatusType, DeploymentStatusType[]> = {
  [DeploymentStatus.PENDING]: [DeploymentStatus.QUEUED, DeploymentStatus.CANCELLED],
  [DeploymentStatus.QUEUED]: [DeploymentStatus.BUILDING, DeploymentStatus.FAILED, DeploymentStatus.CANCELLED],
  [DeploymentStatus.BUILDING]: [
    DeploymentStatus.PUSHING,
    DeploymentStatus.FAILED,
    DeploymentStatus.CANCELLED,
  ],
  [DeploymentStatus.PUSHING]: [
    DeploymentStatus.PROVISIONING,
    DeploymentStatus.FAILED,
    DeploymentStatus.CANCELLED,
  ],
  [DeploymentStatus.PROVISIONING]: [
    DeploymentStatus.DEPLOYING,
    DeploymentStatus.FAILED,
    DeploymentStatus.ROLLING_BACK,
    DeploymentStatus.CANCELLED,
  ],
  [DeploymentStatus.DEPLOYING]: [
    DeploymentStatus.SUCCESS,
    DeploymentStatus.FAILED,
    DeploymentStatus.ROLLING_BACK,
    DeploymentStatus.CANCELLED,
  ],
  [DeploymentStatus.SUCCESS]: [],
  [DeploymentStatus.FAILED]: [],
  [DeploymentStatus.ROLLING_BACK]: [DeploymentStatus.ROLLED_BACK, DeploymentStatus.FAILED],
  [DeploymentStatus.ROLLED_BACK]: [],
  [DeploymentStatus.CANCELLED]: [],
};
