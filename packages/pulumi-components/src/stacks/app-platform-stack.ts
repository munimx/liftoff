import type { LiftoffConfig } from '@liftoff/shared';
import * as digitalocean from '@pulumi/digitalocean';
import * as pulumi from '@pulumi/pulumi';
import { AppPlatformApp } from '../app-platform/app-platform-app';
import { ManagedPostgres } from '../database/managed-postgres';
import { DocrRepository } from '../registry/docr-repository';
import { SpacesBucket } from '../storage/spaces-bucket';
import { buildAppName, buildBucketName, toKebabCase, truncateKebabCase } from '../utils/naming';

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

export interface StackOutputs {
  appUrl: pulumi.Output<string>;
  appId: pulumi.Output<string>;
  repositoryUrl: pulumi.Output<string>;
  dbClusterName?: pulumi.Output<string>;
  dbUri?: pulumi.Output<string>;
  bucketName?: pulumi.Output<string>;
  bucketEndpoint?: pulumi.Output<string>;
}

/**
 * Creates the Liftoff app-platform stack resources in a user's DigitalOcean account.
 */
export function createAppPlatformStack(args: AppPlatformStackArgs): StackOutputs {
  const provider = new digitalocean.Provider('user-account', {
    token: args.doToken,
  });

  const registry = new DocrRepository(
    'registry',
    {
      projectName: args.projectName,
      environmentName: args.environmentName,
      docrName: args.docrName,
      provider,
    },
    { provider },
  );

  let database: ManagedPostgres | undefined;
  if (args.config.database?.enabled) {
    database = new ManagedPostgres(
      'database',
      {
        name: truncateKebabCase(
          toKebabCase(`liftoff-${args.projectName}-${args.environmentName}-db`),
          63,
        ),
        region: args.doRegion,
        size: args.config.database.size ?? 'db-s-1vcpu-1gb',
        version: args.config.database.version ?? '15',
        projectName: args.projectName,
        environmentName: args.environmentName,
        provider,
      },
      { provider },
    );
  }

  let bucket: SpacesBucket | undefined;
  if (args.config.storage?.enabled) {
    bucket = new SpacesBucket(
      'bucket',
      {
        bucketName: buildBucketName(args.projectName, args.environmentName),
        region: args.doRegion,
        projectName: args.projectName,
        environmentName: args.environmentName,
        provider,
      },
      { provider },
    );
  }

  const app = new AppPlatformApp(
    'app',
    {
      appName: buildAppName(args.projectName, args.environmentName),
      projectName: args.projectName,
      environmentName: args.environmentName,
      region: args.doRegion,
      imageUri: args.imageUri,
      httpPort: args.config.runtime.port,
      instanceSizeSlug: args.config.runtime.instance_size,
      instanceCount: args.config.runtime.replicas,
      envVars: args.config.env ?? {},
      secretNames: args.config.secrets ?? [],
      healthCheckPath: args.config.healthcheck?.path ?? '/health',
      database: database
        ? {
            clusterName: database.clusterName,
            dbName: 'liftoff',
            dbUser: 'liftoff',
          }
        : undefined,
      provider,
    },
    { provider },
  );

  const outputs: StackOutputs = {
    appUrl: app.appUrl,
    appId: app.appId,
    repositoryUrl: registry.repositoryUrl,
    ...(database
      ? {
          dbClusterName: database.clusterName,
          dbUri: pulumi.secret(database.uri),
        }
      : {}),
    ...(bucket
      ? {
          bucketName: bucket.bucketName,
          bucketEndpoint: bucket.endpoint,
        }
      : {}),
  };

  return outputs;
}
