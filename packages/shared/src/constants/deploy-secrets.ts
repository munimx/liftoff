const DEPLOY_SECRET_PREFIX = 'LIFTOFF_DEPLOY_SECRET';

/**
 * Returns the GitHub Actions secret name used for an environment deploy callback secret.
 */
export function resolveEnvironmentDeploySecretName(environmentId: string): string {
  const normalizedEnvironmentId = environmentId
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalizedEnvironmentId.length > 0
    ? `${DEPLOY_SECRET_PREFIX}_${normalizedEnvironmentId}`
    : DEPLOY_SECRET_PREFIX;
}
