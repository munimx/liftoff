export interface LiftoffTags {
  'liftoff-project': string;
  'liftoff-environment': string;
  'liftoff-managed': 'true';
}

/**
 * Builds the canonical Liftoff managed tags object.
 */
export function createLiftoffTags(projectName: string, environmentName: string): LiftoffTags {
  return {
    'liftoff-project': projectName,
    'liftoff-environment': environmentName,
    'liftoff-managed': 'true',
  };
}

/**
 * Converts key/value tags to the DigitalOcean string tag format.
 */
export function toDigitalOceanTagList(tags: LiftoffTags): string[] {
  return Object.entries(tags).map(([key, value]) => `${key}:${value}`);
}
