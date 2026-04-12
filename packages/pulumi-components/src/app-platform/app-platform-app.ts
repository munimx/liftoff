import * as digitalocean from '@pulumi/digitalocean';
import * as pulumi from '@pulumi/pulumi';
import { toKebabCase, truncateKebabCase } from '../utils/naming';
import { createLiftoffTags } from '../utils/tags';

type DocrImageReference = {
  registry: string;
  repository: string;
  tag: string;
};

export interface AppPlatformDatabaseArgs {
  clusterName: pulumi.Input<string>;
  dbName: pulumi.Input<string>;
  dbUser: pulumi.Input<string>;
}

export interface AppPlatformAppArgs {
  appName: string;
  projectName: string;
  environmentName: string;
  region: string;
  imageUri: string;
  httpPort: number;
  instanceSizeSlug: string;
  instanceCount: number;
  envVars: Record<string, string>;
  secretNames: string[];
  healthCheckPath: string;
  database?: AppPlatformDatabaseArgs;
  provider: digitalocean.Provider;
}

/**
 * Provisions a DigitalOcean App Platform app using a DOCR image source.
 */
export class AppPlatformApp extends pulumi.ComponentResource {
  public readonly appId: pulumi.Output<string>;
  public readonly appUrl: pulumi.Output<string>;
  public readonly defaultIngress: pulumi.Output<string>;

  public constructor(
    name: string,
    args: AppPlatformAppArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('liftoff:app-platform:AppPlatformApp', name, {}, opts);

    const tags = createLiftoffTags(args.projectName, args.environmentName);
    const parsedImage = this.parseDocrImageUri(args.imageUri);
    const appName = truncateKebabCase(toKebabCase(args.appName), 32);
    const serviceName = truncateKebabCase(
      toKebabCase(`${args.projectName}-${args.environmentName}-svc`),
      32,
    );

    const app = new digitalocean.App(
      `${name}-app`,
      {
        spec: {
          name: appName,
          region: args.region,
          services: [
            {
              name: serviceName,
              image: {
                registry: parsedImage.registry,
                registryType: 'DOCR',
                repository: parsedImage.repository,
                tag: parsedImage.tag,
              },
              httpPort: args.httpPort,
              instanceCount: args.instanceCount,
              instanceSizeSlug: args.instanceSizeSlug,
              healthCheck: {
                httpPath: args.healthCheckPath,
              },
              envs: this.buildServiceEnvs(args.envVars, args.secretNames),
            },
          ],
          ...(args.database
            ? {
                databases: [
                  {
                    name: 'database',
                    clusterName: args.database.clusterName,
                    dbName: args.database.dbName,
                    dbUser: args.database.dbUser,
                    engine: 'PG',
                    production: true,
                  },
                ],
              }
            : {}),
        },
      },
      {
        parent: this,
        provider: args.provider,
      },
    );

    this.appId = app.id;
    this.appUrl = app.liveUrl;
    this.defaultIngress = app.defaultIngress;

    this.registerOutputs({
      appId: this.appId,
      appUrl: this.appUrl,
      defaultIngress: this.defaultIngress,
      tags,
    });
  }

  private parseDocrImageUri(imageUri: string): DocrImageReference {
    const match =
      /^registry\.digitalocean\.com\/(?<registry>[^/]+)\/(?<repository>.+?)(?::(?<tag>[^:]+))?$/.exec(
        imageUri,
      );

    if (!match?.groups?.registry || !match.groups.repository) {
      throw new Error(
        `Invalid image URI "${imageUri}". Expected registry.digitalocean.com/{registry}/{repository}:{tag}`,
      );
    }

    return {
      registry: match.groups.registry,
      repository: match.groups.repository,
      tag: match.groups.tag ?? 'latest',
    };
  }

  private buildServiceEnvs(
    envVars: Record<string, string>,
    secretNames: string[],
  ): digitalocean.types.input.AppSpecServiceEnv[] {
    const generalEnvs = Object.entries(envVars).map(([key, value]) => ({
      key,
      value,
      scope: 'RUN_TIME',
      type: 'GENERAL',
    }));

    const secretEnvs = secretNames.map((secretName) => ({
      key: secretName,
      value: secretName,
      scope: 'RUN_TIME',
      type: 'SECRET',
    }));

    return [...generalEnvs, ...secretEnvs];
  }
}
