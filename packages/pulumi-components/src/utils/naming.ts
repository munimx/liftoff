/**
 * Converts free-form input into kebab-case suitable for DigitalOcean resource names.
 */
export function toKebabCase(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'liftoff';
}

/**
 * Truncates a kebab-case name to a max length without trailing hyphens.
 */
export function truncateKebabCase(value: string, maxLength: number): string {
  const truncated = value.slice(0, maxLength).replace(/-+$/g, '');
  return truncated.length > 0 ? truncated : 'liftoff';
}

/**
 * Builds a Liftoff-managed app name that follows App Platform constraints.
 */
export function buildAppName(projectName: string, environmentName: string): string {
  const kebab = toKebabCase(`liftoff-${projectName}-${environmentName}`);
  return truncateKebabCase(kebab, 32);
}

/**
 * Builds a Spaces bucket name with a conservative length cap.
 */
export function buildBucketName(projectName: string, environmentName: string): string {
  const kebab = toKebabCase(`liftoff-${projectName}-${environmentName}`);
  return truncateKebabCase(kebab, 63);
}
