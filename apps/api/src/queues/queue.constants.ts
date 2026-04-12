/**
 * Queue names used for BullMQ queue registration.
 */
export const QUEUE_NAMES = {
  DEPLOYMENTS: 'deployments',
  INFRASTRUCTURE: 'infrastructure',
} as const;

/**
 * Job names grouped by queue.
 */
export const JOB_NAMES = {
  DEPLOYMENTS: {
    DEPLOY: 'deploy',
    ROLLBACK: 'rollback',
  },
  INFRASTRUCTURE: {
    PROVISION: 'provision',
    DESTROY: 'destroy',
  },
} as const;

/**
 * Queue timing controls (in milliseconds).
 */
export const QUEUE_TIMEOUTS = {
  DEPLOYMENT_JOB_TIMEOUT_MS: 20 * 60 * 1000,
  ACTIVE_DEPLOYMENT_TIMEOUT_MS: 30 * 60 * 1000,
} as const;

export interface DeployJobPayload {
  deploymentId: string;
  environmentId: string;
  commitSha?: string;
}

export interface RollbackJobPayload {
  deploymentId: string;
  targetDeploymentId?: string;
}

export interface InfraProvisionJobPayload {
  deploymentId: string;
  environmentId: string;
  imageUri: string;
  configYaml: string;
}

export interface InfraDestroyJobPayload {
  environmentId: string;
}
