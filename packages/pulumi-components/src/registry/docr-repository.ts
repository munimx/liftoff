import * as digitalocean from '@pulumi/digitalocean';
import * as pulumi from '@pulumi/pulumi';
import { createLiftoffTags } from '../utils/tags';

export interface DocrRepositoryArgs {
  projectName: string;
  environmentName: string;
  docrName: string;
  provider: digitalocean.Provider;
}

/**
 * Creates DigitalOcean Container Registry credentials and computes a repository path.
 */
export class DocrRepository extends pulumi.ComponentResource {
  public readonly repositoryUrl: pulumi.Output<string>;

  public constructor(name: string, args: DocrRepositoryArgs, opts?: pulumi.ComponentResourceOptions) {
    super('liftoff:registry:DocrRepository', name, {}, opts);

    const tags = createLiftoffTags(args.projectName, args.environmentName);

    new digitalocean.ContainerRegistryDockerCredentials(
      `${name}-credentials`,
      {
        registryName: args.docrName,
        write: true,
      },
      {
        parent: this,
        provider: args.provider,
      },
    );

    this.repositoryUrl = pulumi.interpolate`registry.digitalocean.com/${args.docrName}/${args.projectName}/${args.environmentName}`;

    this.registerOutputs({
      repositoryUrl: this.repositoryUrl,
      tags,
    });
  }
}
