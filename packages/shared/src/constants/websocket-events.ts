import type { DeploymentStatusType } from './deployment-status';

/**
 * WebSocket event names for the /deployments namespace.
 */
export const WsEvents = {
  DEPLOYMENT_STATUS: 'deployment:status',
  DEPLOYMENT_LOG: 'deployment:log',
  DEPLOYMENT_COMPLETE: 'deployment:complete',
  INFRASTRUCTURE_PROGRESS: 'infrastructure:progress',
  JOIN_DEPLOYMENT: 'join:deployment',
  JOIN_ENVIRONMENT: 'join:environment',
  LEAVE_DEPLOYMENT: 'leave:deployment',
  LEAVE_ENVIRONMENT: 'leave:environment',
} as const;

export interface WsDeploymentStatusPayload {
  deploymentId: string;
  status: DeploymentStatusType;
  timestamp: string;
}

export interface WsDeploymentLogPayload {
  deploymentId: string;
  line: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
}

export interface WsDeploymentCompletePayload {
  deploymentId: string;
  status: DeploymentStatusType;
  endpoint?: string;
}

export interface WsInfraProgressPayload {
  deploymentId: string;
  resourceType: string;
  resourceName: string;
  action: string;
  status: string;
}
