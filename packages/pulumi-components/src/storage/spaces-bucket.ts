import * as digitalocean from '@pulumi/digitalocean';
import * as pulumi from '@pulumi/pulumi';
import { createLiftoffTags } from '../utils/tags';

export interface SpacesBucketArgs {
  bucketName: string;
  region: string;
  projectName: string;
  environmentName: string;
  provider: digitalocean.Provider;
}

/**
 * Provisions a private Spaces bucket with versioning and CORS defaults.
 */
export class SpacesBucket extends pulumi.ComponentResource {
  public readonly bucketName: pulumi.Output<string>;
  public readonly bucketDomainName: pulumi.Output<string>;
  public readonly endpoint: pulumi.Output<string>;

  public constructor(name: string, args: SpacesBucketArgs, opts?: pulumi.ComponentResourceOptions) {
    super('liftoff:storage:SpacesBucket', name, {}, opts);

    const tags = createLiftoffTags(args.projectName, args.environmentName);

    const bucket = new digitalocean.SpacesBucket(
      `${name}-bucket`,
      {
        name: args.bucketName,
        region: args.region,
        acl: 'private',
        versioning: {
          enabled: true,
        },
      },
      {
        parent: this,
        provider: args.provider,
      },
    );

    new digitalocean.SpacesBucketCorsConfiguration(
      `${name}-cors`,
      {
        bucket: bucket.name,
        region: args.region,
        corsRules: [
          {
            allowedOrigins: ['*'],
            allowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            allowedHeaders: ['*'],
            exposeHeaders: ['ETag'],
            maxAgeSeconds: 3000,
          },
        ],
      },
      {
        parent: this,
        provider: args.provider,
      },
    );

    this.bucketName = bucket.name;
    this.bucketDomainName = bucket.bucketDomainName;
    this.endpoint = bucket.endpoint;

    this.registerOutputs({
      bucketName: this.bucketName,
      bucketDomainName: this.bucketDomainName,
      endpoint: this.endpoint,
      tags,
    });
  }
}
