import * as digitalocean from '@pulumi/digitalocean';
import * as pulumi from '@pulumi/pulumi';
import { createLiftoffTags, toDigitalOceanTagList } from '../utils/tags';

export interface ManagedPostgresArgs {
  name: string;
  region: string;
  size: string;
  version: string;
  projectName: string;
  environmentName: string;
  provider: digitalocean.Provider;
}

/**
 * Provisions a managed PostgreSQL cluster in a user DigitalOcean account.
 */
export class ManagedPostgres extends pulumi.ComponentResource {
  public readonly clusterId: pulumi.Output<string>;
  public readonly clusterName: pulumi.Output<string>;
  public readonly host: pulumi.Output<string>;
  public readonly port: pulumi.Output<string>;
  public readonly database: pulumi.Output<string>;
  public readonly username: pulumi.Output<string>;
  public readonly password: pulumi.Output<string>;
  public readonly uri: pulumi.Output<string>;

  public constructor(
    name: string,
    args: ManagedPostgresArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('liftoff:database:ManagedPostgres', name, {}, opts);

    const tags = createLiftoffTags(args.projectName, args.environmentName);
    const tagList = toDigitalOceanTagList(tags);

    const cluster = new digitalocean.DatabaseCluster(
      `${name}-cluster`,
      {
        name: args.name,
        engine: 'pg',
        version: args.version,
        size: args.size,
        nodeCount: 1,
        region: args.region,
        tags: tagList,
      },
      {
        parent: this,
        provider: args.provider,
      },
    );

    this.clusterId = cluster.id;
    this.clusterName = cluster.name;
    this.host = cluster.host;
    this.port = cluster.port.apply((value) => String(value));
    this.database = cluster.database;
    this.username = cluster.user;
    this.password = cluster.password;
    this.uri = cluster.uri;

    this.registerOutputs({
      clusterId: this.clusterId,
      clusterName: this.clusterName,
      host: this.host,
      port: this.port,
      database: this.database,
      username: this.username,
      password: this.password,
      uri: this.uri,
      tags,
    });
  }
}
