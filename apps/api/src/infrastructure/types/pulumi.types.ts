import type { LiftoffConfig } from '@liftoff/shared';

export type PulumiLogLevel = 'info' | 'warn' | 'error';

export interface AppPlatformStackArgs {
  projectName: string;
  projectId: string;
  environmentName: string;
  environmentId: string;
  doRegion: string;
  doToken: string;
  docrName: string;
  imageUri: string;
  config: LiftoffConfig;
}

export interface PulumiStackOutputs {
  appUrl: string;
  appId: string;
  repositoryUrl: string;
  dbClusterName?: string;
  dbUri?: string;
  bucketName?: string;
  bucketEndpoint?: string;
}

export interface PulumiResourceProgress {
  resourceType: string;
  resourceName: string;
  action: string;
  status: 'started' | 'completed';
}

export interface PulumiRunOptions {
  stackName: string;
  doToken: string;
  args: AppPlatformStackArgs;
  onLog?: (line: string, level: PulumiLogLevel) => void;
  onResourceProgress?: (progress: PulumiResourceProgress) => void;
}

export interface PulumiRunResult {
  success: boolean;
  outputs: Partial<PulumiStackOutputs>;
  error?: string;
}

export interface PulumiPreviewResult {
  success: boolean;
  changeSummary: Record<string, number>;
  error?: string;
}
