/**
 * Team role constants used in project RBAC.
 */
export const ProjectRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  DEVELOPER: 'DEVELOPER',
  VIEWER: 'VIEWER',
} as const;

export type ProjectRoleType = (typeof ProjectRole)[keyof typeof ProjectRole];
