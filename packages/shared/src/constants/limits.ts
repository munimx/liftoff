/**
 * Platform-enforced product limits.
 */
export const Limits = {
  MAX_PROJECTS_FREE: 3,
  MAX_ENVIRONMENTS_PER_PROJECT: 3,
  MAX_TEAM_MEMBERS: 5,
  DEPLOYMENT_TIMEOUT_MS: 20 * 60 * 1000,
  DOCR_IMAGE_RETENTION_COUNT: 10,
} as const;
