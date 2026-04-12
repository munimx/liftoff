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
