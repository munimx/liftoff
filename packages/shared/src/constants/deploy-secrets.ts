export const LIFTOFF_DEPLOY_SECRET_NAME = 'LIFTOFF_DEPLOY_SECRET';
export const DIGITALOCEAN_ACCESS_TOKEN_SECRET_NAME = 'DIGITALOCEAN_ACCESS_TOKEN';

/**
 * Returns the GitHub Actions secret name used for an environment deploy callback secret.
 */
export function resolveEnvironmentDeploySecretName(_environmentId: string): string {
  return LIFTOFF_DEPLOY_SECRET_NAME;
}
